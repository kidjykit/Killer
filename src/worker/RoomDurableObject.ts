import {
  DEFAULT_SETTINGS,
  type ChatMessage,
  type ClientMessage,
  type NightActions,
  type NightReport,
  type Phase,
  type Player,
  type RoleId,
  type RoomSettings,
  type RoomView,
  type ServerMessage,
  type VoteReport,
  type Winner,
} from '../shared/types';
import { MAX_PLAYERS, buildDeck, deckFor, shuffle, validateCount } from '../shared/roles';
import { checkWinner, publicNightAnnouncement, resolveNight, tallyVotes } from '../shared/engine';
import { type IdlePolicy, maintenanceDue, nextMaintenanceAt, policyFromEnv } from './maintenance';

const CHAT_LIMIT = 200;
/** บทบาทที่มี action ตอนกลางคืน — ทุกบทบาทนี้ลืมตาพร้อมกัน ไม่ได้เรียกทีละคน */
const NIGHT_ROLES: RoleId[] = ['KILLER', 'POLICE', 'NUN', 'THIEF'];
/** โหมด AUTO: กลางคืนต้องเดินครบเวลาเสมอ ไม่ตัดจบเร็วแม้ทุกคนกดครบแล้ว
 *  มิฉะนั้นความเร็วในการจบคืนจะกลายเป็นเบาะแสว่ามีบทบาทไหนตายไปบ้าง */
const AUTO_NIGHT_FALLBACK = 45;
/** โหมด AUTO: เวลาให้อ่านผลประกาศก่อนเปิดอภิปราย และเวลาให้อ่านผลโหวตก่อนขึ้นคืนใหม่ (วินาที) */
const AUTO_READ_REPORT = 12;
const AUTO_READ_VOTE = 15;
/** เพดานประวัติที่เก็บไว้ในห้อง กันไม่ให้ข้อมูลโตไม่สิ้นสุดเมื่อเล่นกันยาว ๆ */
const PUBLIC_LOG_LIMIT = 120;
const REPORT_LIMIT = 40;

interface RoomState {
  code: string;
  settings: RoomSettings;
  phase: Phase;
  round: number;
  players: Player[];
  actions: NightActions;
  nightReports: NightReport[];
  voteReports: VoteReport[];
  publicLog: string[];
  chat: ChatMessage[];
  votes: Record<string, string>;
  isRevote: boolean;
  winner: Winner | null;
  deadline: number | null;
  nunSelfHealUsed: number;
  /** ผลตรวจของตำรวจรายคืน: round -> ผล */
  policeResults: Record<number, { targetName: string; isKiller: boolean }>;
  /** กองไพ่ที่เหลือให้จั่ว ตอนเฟส DEALING */
  deck: Array<{ role: RoleId; card: string }>;
  createdAt: number;
  /** ครั้งล่าสุดที่มีข้อความจากผู้เล่นเข้ามา ใช้วัดว่าห้องถูกทิ้งร้างหรือยัง */
  lastActivity: number;
}

const emptyActions = (): NightActions => ({
  killVotes: {},
  policeTarget: null,
  nunTarget: null,
  thiefTarget: null,
});

export class RoomDurableObject implements DurableObject {
  private state: DurableObjectState;
  private room: RoomState | null = null;
  /** ws -> playerId */
  private sockets = new Map<WebSocket, string>();
  private policy: IdlePolicy;
  /** กันไม่ให้ PING ที่ส่งมาทุก 25 วินาทีเขียน storage ถี่เกินจำเป็น */
  private lastHeartbeatSave = 0;

  constructor(state: DurableObjectState, env: Record<string, unknown> = {}) {
    this.state = state;
    this.policy = policyFromEnv(env);
  }

  private async load(code: string): Promise<RoomState> {
    if (this.room) return this.room;
    const stored = await this.state.storage.get<RoomState>('room');
    this.room =
      stored ??
      {
        code,
        settings: { ...DEFAULT_SETTINGS },
        phase: 'LOBBY',
        round: 0,
        players: [],
        actions: emptyActions(),
        nightReports: [],
        voteReports: [],
        publicLog: [],
        chat: [],
        votes: {},
        isRevote: false,
        winner: null,
        deadline: null,
        nunSelfHealUsed: 0,
        policeResults: {},
        deck: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
    // ห้องที่บันทึกไว้ก่อนมีฟีเจอร์นี้จะยังไม่มี lastActivity
    this.room.lastActivity ??= this.room.createdAt ?? Date.now();
    return this.room;
  }

  private async save() {
    if (!this.room) return;
    this.trimHistory(this.room);
    await this.state.storage.put('room', this.room);
  }

  /** ตัดประวัติเก่าทิ้งก่อนบันทึกทุกครั้ง เพื่อให้ขนาดห้องมีเพดานเสมอ */
  private trimHistory(room: RoomState) {
    if (room.publicLog.length > PUBLIC_LOG_LIMIT) {
      room.publicLog = room.publicLog.slice(-PUBLIC_LOG_LIMIT);
    }
    if (room.nightReports.length > REPORT_LIMIT) {
      room.nightReports = room.nightReports.slice(-REPORT_LIMIT);
    }
    if (room.voteReports.length > REPORT_LIMIT) {
      room.voteReports = room.voteReports.slice(-REPORT_LIMIT);
    }
    if (room.chat.length > CHAT_LIMIT) room.chat = room.chat.slice(-CHAT_LIMIT);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') ?? 'ROOM').toUpperCase();
    const room = await this.load(code);

    if (url.pathname.endsWith('/exists')) {
      return Response.json({ exists: room.players.length > 0 || room.phase !== 'LOBBY', code: room.code });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    this.sockets.set(server, '');

    server.addEventListener('message', (event) => {
      void this.onMessage(server, String(event.data));
    });
    const drop = () => void this.onClose(server);
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);

    return new Response(null, { status: 101, webSocket: client });
  }

  /* ------------------------------------------------------------------ */

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.sockets.delete(ws);
    }
  }

  private error(ws: WebSocket, message: string) {
    this.send(ws, { t: 'ERROR', message });
  }

  private broadcast() {
    const room = this.room;
    if (!room) return;
    for (const [ws, playerId] of this.sockets) {
      if (!playerId) continue;
      this.send(ws, { t: 'STATE', view: this.viewFor(room, playerId) });
    }
  }

  private async onClose(ws: WebSocket) {
    const playerId = this.sockets.get(ws);
    this.sockets.delete(ws);
    if (!playerId || !this.room) return;
    // ยังมีแท็บอื่นของคนเดิมเปิดอยู่หรือไม่
    if ([...this.sockets.values()].includes(playerId)) return;
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player) return;
    player.connected = false;
    // ออกจากห้องจริง ๆ เฉพาะตอนยังไม่เริ่มเกม
    if (this.room.phase === 'LOBBY') {
      this.room.players = this.room.players.filter((p) => p.id !== playerId);
      this.reseat();
      if (player.isHost) {
        const next = this.room.players[0];
        if (next) next.isHost = true;
      }
    }
    await this.save();
    this.broadcast();
  }

  private reseat() {
    if (!this.room) return;
    this.room.players.forEach((p, i) => (p.seat = i));
  }

  private async onMessage(ws: WebSocket, raw: string) {
    const room = this.room;
    if (!room) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return this.error(ws, 'ข้อความไม่ถูกต้อง');
    }

    room.lastActivity = Date.now();
    if (msg.t === 'PING') {
      this.send(ws, { t: 'PONG' });
      // ต่ออายุห้องไว้ แต่เขียน storage อย่างมากนาทีละครั้ง
      if (Date.now() - this.lastHeartbeatSave > 60_000) {
        this.lastHeartbeatSave = Date.now();
        await this.scheduleAlarm(room);
        await this.save();
      }
      return;
    }

    if (msg.t === 'JOIN') return this.handleJoin(ws, room, msg);

    const playerId = this.sockets.get(ws);
    const me = room.players.find((p) => p.id === playerId);
    if (!me) return this.error(ws, 'ยังไม่ได้เข้าห้อง');

    const modOnly = () => {
      if (!this.isController(room, me)) {
        this.error(ws, 'เฉพาะผู้ดำเนินเกมเท่านั้นที่สั่งได้');
        return false;
      }
      return true;
    };

    switch (msg.t) {
      case 'SET_SETTINGS': {
        if (!me.isHost) return this.error(ws, 'เฉพาะเจ้าของห้องเท่านั้นที่แก้กติกาได้');
        if (room.phase !== 'LOBBY') return this.error(ws, 'แก้กติกาได้เฉพาะตอนอยู่ในล็อบบี้');
        room.settings = { ...room.settings, ...msg.settings };
        if (room.settings.moderatorMode === 'AUTO') room.players.forEach((p) => (p.isModerator = false));
        break;
      }
      case 'CLAIM_MODERATOR': {
        if (!me.isHost) return this.error(ws, 'เฉพาะเจ้าของห้องเท่านั้นที่ตั้งพิธีกรได้');
        if (room.phase !== 'LOBBY') return this.error(ws, 'ตั้งพิธีกรได้เฉพาะตอนอยู่ในล็อบบี้');
        room.players.forEach((p) => (p.isModerator = p.id === msg.playerId));
        break;
      }
      case 'KICK': {
        if (!me.isHost) return this.error(ws, 'เฉพาะเจ้าของห้องเท่านั้นที่เตะผู้เล่นได้');
        if (room.phase !== 'LOBBY') return this.error(ws, 'เตะผู้เล่นได้เฉพาะตอนอยู่ในล็อบบี้');
        room.players = room.players.filter((p) => p.id !== msg.playerId || p.isHost);
        this.reseat();
        break;
      }
      case 'START_GAME': {
        if (!me.isHost) return this.error(ws, 'เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้');
        const err = this.startGame(room);
        if (err) return this.error(ws, err);
        break;
      }
      case 'DRAW_CARD': {
        if (room.phase !== 'DEALING') return this.error(ws, 'ยังไม่ถึงเวลาจั่วไพ่');
        if (me.isModerator) return this.error(ws, 'พิธีกรไม่ได้รับไพ่');
        if (me.role) return this.error(ws, 'คุณจั่วไพ่ไปแล้ว');
        const drawn = room.deck.pop();
        if (!drawn) return this.error(ws, 'ไพ่ในกองหมดแล้ว');
        me.role = drawn.role;
        me.card = drawn.card;
        if (room.deck.length === 0) {
          room.publicLog.push('🃏 ทุกคนจั่วไพ่ครบแล้ว — พร้อมเข้าสู่คืนแรก');
          if (room.settings.moderatorMode === 'AUTO') this.beginNight(room);
        }
        break;
      }
      case 'BEGIN_NIGHT': {
        if (!modOnly()) return;
        if (room.phase !== 'DEALING' && room.phase !== 'VOTE_RESULT' && room.phase !== 'DISCUSSION') {
          return this.error(ws, 'ยังเข้าสู่กลางคืนไม่ได้ในตอนนี้');
        }
        if (room.deck.length > 0) return this.error(ws, 'ยังมีคนจั่วไพ่ไม่ครบ');
        this.beginNight(room);
        break;
      }
      case 'NIGHT_ACTION': {
        const err = this.submitNightAction(room, me, msg.targetId);
        if (err) return this.error(ws, err);
        break;
      }
      case 'END_NIGHT': {
        if (!modOnly()) return;
        if (room.phase !== 'NIGHT') return this.error(ws, 'ตอนนี้ไม่ใช่ช่วงกลางคืน');
        this.resolveNightPhase(room);
        break;
      }
      case 'OPEN_DISCUSSION': {
        if (!modOnly()) return;
        if (room.phase !== 'DAY_REPORT' && room.phase !== 'VOTE_RESULT') {
          return this.error(ws, 'ยังเปิดช่วงอภิปรายไม่ได้');
        }
        room.phase = 'DISCUSSION';
        room.deadline = room.settings.discussionSeconds
          ? Date.now() + room.settings.discussionSeconds * 1000
          : null;
        room.publicLog.push('💬 เปิดช่วงอภิปราย');
        break;
      }
      case 'OPEN_VOTE': {
        if (!modOnly()) return;
        if (room.phase !== 'DISCUSSION' && room.phase !== 'DAY_REPORT') {
          return this.error(ws, 'ยังเปิดโหวตไม่ได้');
        }
        room.phase = 'VOTE';
        room.votes = {};
        room.deadline = null;
        room.publicLog.push(room.isRevote ? '🗳️ โหวตแก้ตัวรอบสอง' : '🗳️ เปิดให้โหวต');
        break;
      }
      case 'CAST_VOTE': {
        if (room.phase !== 'VOTE') return this.error(ws, 'ยังไม่ถึงเวลาโหวต');
        if (!me.alive || me.isModerator) return this.error(ws, 'คุณไม่มีสิทธิ์โหวต');
        const target = room.players.find((p) => p.id === msg.targetId);
        if (msg.targetId !== 'SKIP' && (!target || !target.alive || target.isModerator)) {
          return this.error(ws, 'โหวตคนนี้ไม่ได้');
        }
        room.votes[me.id] = msg.targetId;
        if (room.settings.moderatorMode === 'AUTO' && this.allVoted(room)) this.closeVote(room);
        break;
      }
      case 'CLOSE_VOTE': {
        if (!modOnly()) return;
        if (room.phase !== 'VOTE') return this.error(ws, 'ตอนนี้ไม่ใช่ช่วงโหวต');
        this.closeVote(room);
        break;
      }
      case 'NEXT_ROUND': {
        if (!modOnly()) return;
        if (room.phase !== 'VOTE_RESULT') return this.error(ws, 'ยังไปรอบถัดไปไม่ได้');
        if (room.isRevote) {
          room.phase = 'VOTE';
          room.votes = {};
          room.publicLog.push('🗳️ โหวตแก้ตัวรอบสอง');
        } else {
          this.beginNight(room);
        }
        break;
      }
      case 'CHAT': {
        const err = this.handleChat(room, me, msg.text, msg.channel);
        if (err) return this.error(ws, err);
        break;
      }
      case 'RESTART': {
        if (!me.isHost) return this.error(ws, 'เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมใหม่ได้');
        this.resetToLobby(room);
        break;
      }
    }

    await this.scheduleAlarm(room);
    await this.save();
    this.broadcast();
  }

  /* ---------------------------- join ---------------------------- */

  private handleJoin(ws: WebSocket, room: RoomState, msg: Extract<ClientMessage, { t: 'JOIN' }>) {
    const name = msg.name.trim().slice(0, 20) || 'ผู้เล่น';
    let player = room.players.find((p) => p.id === msg.playerId);

    if (!player) {
      if (room.phase !== 'LOBBY') return this.error(ws, 'เกมเริ่มไปแล้ว เข้าร่วมกลางคันไม่ได้');
      if (room.players.length >= MAX_PLAYERS + 1) return this.error(ws, 'ห้องเต็มแล้ว');
      const isFirst = room.players.length === 0;
      player = {
        id: msg.playerId,
        name,
        isHost: isFirst,
        isModerator: isFirst && room.settings.moderatorMode === 'HUMAN' && msg.wantModerator !== false,
        connected: true,
        alive: true,
        role: null,
        card: null,
        deathCause: null,
        deathRound: null,
        seat: room.players.length,
      };
      room.players.push(player);
      room.publicLog.push(`👋 ${name} เข้าห้อง`);
    } else {
      player.name = name;
      player.connected = true;
    }

    this.sockets.set(ws, player.id);
    void this.scheduleAlarm(room).then(() => this.save());
    this.broadcast();
  }

  /* ---------------------------- game flow ---------------------------- */

  /** ใครกดสั่งเดินเกมได้: โหมด HUMAN = พิธีกร, โหมด AUTO = เจ้าของห้อง (ยังต้องมีคนกดเปิดรอบ) */
  private isController(room: RoomState, p: Player) {
    return room.settings.moderatorMode === 'HUMAN' ? p.isModerator : p.isHost;
  }

  private cardHolders(room: RoomState) {
    return room.players.filter((p) => !p.isModerator);
  }

  private startGame(room: RoomState): string | null {
    if (room.phase !== 'LOBBY') return 'เกมเริ่มไปแล้ว';
    if (room.settings.moderatorMode === 'HUMAN' && !room.players.some((p) => p.isModerator)) {
      return 'โหมดนี้ต้องเลือกพิธีกรก่อนเริ่มเกม';
    }
    const holders = this.cardHolders(room);
    const err = validateCount(holders.length);
    if (err) return err;

    const comp = deckFor(holders.length);
    room.deck = shuffle(buildDeck(comp));
    room.phase = 'DEALING';
    room.round = 0;
    room.winner = null;
    room.nightReports = [];
    room.voteReports = [];
    room.votes = {};
    room.isRevote = false;
    room.nunSelfHealUsed = 0;
    room.policeResults = {};
    room.deadline = null;
    room.players.forEach((p) => {
      p.alive = !p.isModerator;
      p.role = null;
      p.card = null;
      p.deathCause = null;
      p.deathRound = null;
    });
    room.publicLog.push(
      `🃏 เริ่มเกม! ผู้เล่น ${holders.length} คน — Killer ${comp.KILLER} / ตำรวจ ${comp.POLICE} / แม่ชี ${comp.NUN} / โจร ${comp.THIEF} / ประชาชน ${comp.VILLAGER}`,
    );
    return null;
  }

  private beginNight(room: RoomState) {
    room.round += 1;
    room.phase = 'NIGHT';
    room.actions = emptyActions();
    room.votes = {};
    room.isRevote = false;
    room.publicLog.push(`🌙 คืนที่ ${room.round} — ทุกคนหลับตา`);

    // กลางคืนเป็นช่วงเดียว ทุกบทบาทกดพร้อมกันได้เลย ไม่ต้องรอเรียกทีละคน
    const auto = room.settings.moderatorMode === 'AUTO';
    const secs = auto ? room.settings.nightSeconds || AUTO_NIGHT_FALLBACK : room.settings.nightSeconds;
    room.deadline = secs ? Date.now() + secs * 1000 : null;
  }

  /** ตำรวจสืบได้รอบละ 1 ครั้ง กดแล้วเปลี่ยนใจไม่ได้ บทบาทอื่นแก้ตัวเลือกได้จนหมดเวลา */
  private isLocked(room: RoomState, me: Player) {
    return me.role === 'POLICE' && !!room.policeResults[room.round];
  }

  private submitNightAction(room: RoomState, me: Player, targetId: string | null): string | null {
    if (room.phase !== 'NIGHT') return 'ตอนนี้ไม่ใช่ช่วงกลางคืน';
    if (!me.alive || !me.role) return 'คุณทำ action ไม่ได้';
    if (!NIGHT_ROLES.includes(me.role)) return 'บทบาทของคุณไม่มี action ตอนกลางคืน';
    if (this.isLocked(room, me)) return 'ตำรวจสืบได้รอบละ 1 ครั้งเท่านั้น รอคืนถัดไป';

    const target = targetId ? room.players.find((p) => p.id === targetId) : null;
    if (targetId && (!target || !target.alive || target.isModerator)) return 'เลือกคนนี้ไม่ได้';

    switch (me.role) {
      case 'KILLER':
        if (target?.role === 'KILLER') return 'Killer ฆ่ากันเองไม่ได้';
        if (targetId) room.actions.killVotes[me.id] = targetId;
        else delete room.actions.killVotes[me.id];
        break;
      case 'POLICE':
        if (targetId === me.id) return 'ตำรวจสืบตัวเองไม่ได้';
        if (!target) return 'ต้องเลือกคนที่จะสืบ';
        room.actions.policeTarget = targetId;
        room.policeResults[room.round] = { targetName: target.name, isKiller: target.role === 'KILLER' };
        break;
      case 'NUN': {
        const limit = room.settings.nunSelfHealLimit;
        if (targetId === me.id && limit >= 0 && room.nunSelfHealUsed >= limit) {
          return limit === 0 ? 'ห้องนี้ตั้งกติกาว่าแม่ชีรักษาตัวเองไม่ได้' : `รักษาตัวเองได้ไม่เกิน ${limit} ครั้งต่อเกม`;
        }
        room.actions.nunTarget = targetId;
        break;
      }
      case 'THIEF':
        room.actions.thiefTarget = targetId;
        break;
    }
    return null;
  }

  /** ผู้เล่นที่ยังมีชีวิตและมี action ตอนกลางคืน (ใช้ทำแผงสถานะของพิธีกร) */
  private nightActors(room: RoomState) {
    return room.players.filter((p) => p.alive && p.role && NIGHT_ROLES.includes(p.role));
  }

  /** id ของคนที่ส่ง action ของคืนนี้แล้ว */
  private nightSubmitted(room: RoomState) {
    const ids = Object.keys(room.actions.killVotes);
    for (const p of this.nightActors(room)) {
      const done =
        (p.role === 'POLICE' && room.actions.policeTarget) ||
        (p.role === 'NUN' && room.actions.nunTarget) ||
        (p.role === 'THIEF' && room.actions.thiefTarget);
      if (done) ids.push(p.id);
    }
    return ids;
  }

  private resolveNightPhase(room: RoomState) {
    const report = resolveNight(room.players, room.actions, room.round);
    if (report.nunHealedSelf && !report.nunDisabled) room.nunSelfHealUsed += 1;

    if (report.deadPlayerId) {
      const victim = room.players.find((p) => p.id === report.deadPlayerId);
      if (victim) {
        victim.alive = false;
        victim.deathCause = 'KILLED';
        victim.deathRound = room.round;
      }
    }

    room.nightReports.push(report);
    room.phase = 'DAY_REPORT';
    room.deadline =
      room.settings.moderatorMode === 'AUTO' ? Date.now() + AUTO_READ_REPORT * 1000 : null;
    room.publicLog.push('☀️ ทุกคนลืมตา');
    room.publicLog.push(publicNightAnnouncement(report));
    if (report.deadPlayerId && room.settings.revealRoleOnDeath) {
      const victim = room.players.find((p) => p.id === report.deadPlayerId);
      if (victim?.role) room.publicLog.push(`🔖 ${victim.name} คือ ${victim.role}`);
    }
    this.finishIfOver(room);
  }

  private allVoted(room: RoomState) {
    const voters = room.players.filter((p) => p.alive && !p.isModerator);
    return voters.length > 0 && voters.every((p) => room.votes[p.id]);
  }

  private closeVote(room: RoomState) {
    const report = tallyVotes(room.players, room.votes, room.round, room.isRevote);
    if (report.eliminatedId) {
      const out = room.players.find((p) => p.id === report.eliminatedId);
      if (out) {
        out.alive = false;
        out.deathCause = 'VOTED';
        out.deathRound = room.round;
        room.publicLog.push(`⚖️ ${out.name} ถูกโหวตออกจากเกม`);
        if (room.settings.revealRoleOnDeath && out.role) {
          room.publicLog.push(`🔖 ${out.name} คือ ${out.role}`);
        }
      }
      room.isRevote = false;
    } else if (report.tied && !room.isRevote) {
      room.isRevote = true;
      room.publicLog.push('⚖️ คะแนนเท่ากัน — พูดแก้ตัวคนละ 30 วินาที แล้วโหวตใหม่');
    } else {
      room.isRevote = false;
      room.publicLog.push('⚖️ ไม่มีใครถูกกำจัดในรอบนี้');
    }

    room.voteReports.push(report);
    room.phase = 'VOTE_RESULT';
    room.deadline =
      room.settings.moderatorMode === 'AUTO' ? Date.now() + AUTO_READ_VOTE * 1000 : null;
    this.finishIfOver(room);
  }

  private finishIfOver(room: RoomState) {
    const winner = checkWinner(room.players);
    if (!winner) return;
    room.winner = winner;
    room.phase = 'ENDED';
    room.deadline = null;
    room.publicLog.push(`🏁 ${winner.reason}`);
  }

  private resetToLobby(room: RoomState) {
    room.phase = 'LOBBY';
    room.round = 0;
    room.winner = null;
    room.deck = [];
    room.actions = emptyActions();
    room.votes = {};
    room.isRevote = false;
    room.nightReports = [];
    room.voteReports = [];
    room.policeResults = {};
    room.nunSelfHealUsed = 0;
    room.deadline = null;
    room.publicLog = ['↩️ กลับสู่ล็อบบี้ พร้อมเริ่มเกมใหม่'];
    room.players.forEach((p) => {
      p.alive = true;
      p.role = null;
      p.card = null;
      p.deathCause = null;
      p.deathRound = null;
    });
  }

  /* ---------------------------- chat ---------------------------- */

  private handleChat(room: RoomState, me: Player, rawText: string, channel: ChatMessage['channel']): string | null {
    const text = rawText.trim().slice(0, 400);
    if (!text) return null;

    if (channel === 'KILLER') {
      if (me.role !== 'KILLER' || !me.alive) return 'คุณไม่มีสิทธิ์ใช้ห้องแชทนี้';
    } else if (channel === 'DEAD') {
      if (me.alive && !me.isModerator) return 'ห้องแชทนี้สำหรับผู้เล่นที่ตายแล้ว';
    } else {
      // ช่องสาธารณะ: คนตายพูดไม่ได้ และกลางคืนพูดไม่ได้ (rule.md §6)
      if (!me.alive && !me.isModerator) return 'ผู้เล่นที่ตายแล้วพูดในห้องหลักไม่ได้';
      if (room.phase === 'NIGHT' && !me.isModerator) return 'ช่วงกลางคืนห้ามพูดในห้องหลัก';
    }

    room.chat.push({
      id: crypto.randomUUID(),
      playerId: me.id,
      name: me.isModerator ? `${me.name} (พิธีกร)` : me.name,
      text,
      at: Date.now(),
      channel,
    });
    if (room.chat.length > CHAT_LIMIT) room.chat = room.chat.slice(-CHAT_LIMIT);
    return null;
  }

  /* ---------------------------- timers ---------------------------- */

  /**
   * Durable Object ตั้ง alarm ได้ทีละอันเดียว จึงต้องเอาเวลาที่ใกล้ที่สุดระหว่าง
   * "หมดเวลาเฟส" กับ "ถึงรอบเก็บกวาดห้องร้าง" มาใช้
   */
  private async scheduleAlarm(room: RoomState) {
    const maintenance = nextMaintenanceAt(room.phase, room.lastActivity, this.policy);
    const target = Math.min(room.deadline ?? Number.POSITIVE_INFINITY, maintenance);
    const existing = await this.state.storage.getAlarm();

    // ถ้าต้องตื่นเร็วขึ้นกว่าเดิม ต้องตั้งใหม่เสมอ ไม่งั้นจะพลาดรอบ
    // (เช่น ห้องเปลี่ยนจากล็อบบี้เป็นกำลังเล่น กำหนดตรวจจะขยับเข้ามาใกล้ขึ้น)
    // ส่วนการเลื่อนออกไปเพราะ ping ยอมให้คลาดได้ จะได้ไม่เขียน storage ถี่เกินจำเป็น
    const slack = target === room.deadline ? 1_000 : 60_000;
    if (existing === null || target < existing - 1_000 || target > existing + slack) {
      await this.state.storage.setAlarm(target);
    }
  }

  /** ลบห้องทิ้งทั้งห้อง แล้วตัดการเชื่อมต่อที่ยังค้างอยู่ */
  private async destroyRoom() {
    for (const ws of this.sockets.keys()) {
      try {
        ws.close(1000, 'ห้องถูกลบเพราะไม่มีการใช้งาน');
      } catch {
        /* ปิดไปแล้ว */
      }
    }
    this.sockets.clear();
    this.room = null;
    await this.state.storage.deleteAll();
  }

  /**
   * เกมค้างและไม่มีใครแตะมานาน → เด้งกลับล็อบบี้และเอาคนที่หลุดไปแล้วออก
   * เพื่อให้เปิดลิงก์เดิมแล้วตั้งวงใหม่ได้ ไม่ติด "เกมเริ่มไปแล้ว เข้าร่วมกลางคันไม่ได้"
   */
  private idleResetToLobby(room: RoomState) {
    this.resetToLobby(room);
    room.players = room.players.filter((p) => p.connected);
    this.reseat();
    if (room.players.length && !room.players.some((p) => p.isHost)) room.players[0].isHost = true;
    room.publicLog = ['💤 ห้องถูกทิ้งไว้นาน ระบบรีเซ็ตกลับสู่ล็อบบี้ให้แล้ว'];
  }

  async alarm() {
    const room = this.room ?? (await this.state.storage.get<RoomState>('room')) ?? null;
    if (!room) return;
    this.room = room;
    // เก็บกวาดห้องร้างก่อนเสมอ ไม่ว่า alarm นี้จะถูกตั้งไว้เพราะอะไร
    const due = maintenanceDue(room.phase, Date.now() - room.lastActivity, this.policy);
    if (due === 'delete') {
      await this.destroyRoom();
      return;
    }
    if (due === 'reset') {
      this.idleResetToLobby(room);
      room.deadline = null;
      await this.scheduleAlarm(room);
      await this.save();
      this.broadcast();
      return;
    }

    if (!room.deadline || Date.now() < room.deadline - 500) {
      await this.scheduleAlarm(room);
      return;
    }

    if (room.phase === 'NIGHT') {
      // หมดเวลากลางคืน → สรุปผลเสมอ ไม่ว่าจะมีใครยังไม่กดหรือไม่
      this.resolveNightPhase(room);
    } else if (room.phase === 'DISCUSSION') {
      room.deadline = null;
      room.publicLog.push('⏰ หมดเวลาอภิปราย');
      if (room.settings.moderatorMode === 'AUTO') {
        room.phase = 'VOTE';
        room.votes = {};
        room.publicLog.push(room.isRevote ? '🗳️ โหวตแก้ตัวรอบสอง' : '🗳️ เปิดให้โหวต');
      }
    } else if (room.phase === 'DAY_REPORT' && room.settings.moderatorMode === 'AUTO') {
      room.phase = 'DISCUSSION';
      room.deadline = room.settings.discussionSeconds
        ? Date.now() + room.settings.discussionSeconds * 1000
        : null;
      room.publicLog.push('💬 เปิดช่วงอภิปราย');
    } else if (room.phase === 'VOTE_RESULT' && room.settings.moderatorMode === 'AUTO') {
      if (room.isRevote) {
        room.phase = 'VOTE';
        room.votes = {};
        room.deadline = null;
        room.publicLog.push('🗳️ โหวตแก้ตัวรอบสอง');
      } else {
        this.beginNight(room);
      }
    } else {
      room.deadline = null;
    }

    await this.scheduleAlarm(room);
    await this.save();
    this.broadcast();
  }

  /* ---------------------------- view ---------------------------- */

  private viewFor(room: RoomState, viewerId: string): RoomView {
    const viewer = room.players.find((p) => p.id === viewerId);
    const isMod = !!viewer?.isModerator;
    const ended = room.phase === 'ENDED';
    const privacyLock = room.phase === 'NIGHT';

    const players: Player[] = room.players.map((p) => {
      const canSeeRole = isMod || ended || p.id === viewerId || (room.settings.revealRoleOnDeath && !p.alive);
      return {
        ...p,
        role: canSeeRole ? p.role : null,
        card: canSeeRole ? p.card : null,
        // กลางคืนซ่อนสถานะ online ของผู้เล่นทุกคนจากสายตาคนอื่น เพื่อกันการระบุตัวตน
        connected: privacyLock && !isMod && p.id !== viewerId ? true : p.connected,
      };
    });

    const inNight = room.phase === 'NIGHT';
    const youHaveNightAction =
      inNight && !!viewer?.alive && !!viewer.role && NIGHT_ROLES.includes(viewer.role);

    const yourNightTarget = !youHaveNightAction
      ? null
      : viewer!.role === 'KILLER'
        ? room.actions.killVotes[viewerId] ?? null
        : viewer!.role === 'POLICE'
          ? room.actions.policeTarget
          : viewer!.role === 'NUN'
            ? room.actions.nunTarget
            : room.actions.thiefTarget;

    const isKiller = viewer?.role === 'KILLER';
    const chat = room.chat.filter((m) => {
      if (m.channel === 'ALL') return true;
      if (m.channel === 'KILLER') return isMod || isKiller;
      if (m.channel === 'DEAD') return isMod || !viewer?.alive;
      return false;
    });

    return {
      code: room.code,
      settings: room.settings,
      phase: room.phase,
      round: room.round,
      players,
      youId: viewerId,
      yourRole: viewer?.role ?? null,
      yourCard: viewer?.card ?? null,
      isModerator: isMod,
      privacyLock,
      youHaveNightAction,
      yourNightTarget,
      yourActionLocked: youHaveNightAction && this.isLocked(room, viewer!),
      submittedPlayerIds: isMod && inNight ? this.nightSubmitted(room) : [],
      policeResult: viewer?.role === 'POLICE' ? room.policeResults[room.round] ?? null : null,
      fellowKillerIds: isKiller
        ? room.players.filter((p) => p.role === 'KILLER' && p.id !== viewerId).map((p) => p.id)
        : [],
      killVotes: isKiller || isMod ? room.actions.killVotes : {},
      nightReports: isMod || ended ? room.nightReports : [],
      voteReports: room.voteReports,
      publicLog: room.publicLog.slice(-60),
      chat,
      winner: room.winner,
      deadline: room.deadline,
      finalReveal: ended
        ? room.players
            .filter((p) => p.role)
            .map((p) => ({ playerId: p.id, name: p.name, role: p.role!, card: p.card! }))
        : null,
    };
  }
}
