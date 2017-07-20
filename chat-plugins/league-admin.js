/**
 * TPPLeague Admin Commands
 * TPPLeague - https://tppleague.me/
 *
 * This command namespace is used internally by the client to communicate
 * for the Adventure Builder / TPPLeague Administration room(s).
 *
 * For the API, see chat-plugins/COMMANDS.md
 *
 * @license MIT license
 */
 /* global Rooms */
 
'use strict';

const proxy = require("../save-proxy.js");

const LEAGUE_CONFIG_FILE = require.resolve("../config/league/league_setup.json");
const DEL_TIMEOUT = 1000*60*2;

var delConfirm = {};

if (!global.LeagueSetup) global.LeagueSetup = proxy(LEAGUE_CONFIG_FILE, '\t');
/* global LeagueSetup */

const alpha = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function createToken() {
	let id = "";
	for (let i = 0; i < 11; i++) {
		id += alpha[Math.floor(Math.random()*alpha.length)];
	}
	return id;
}
function confirmToken(token) {
	// If we have a confirmation token
	// console.log(`confirmToken(${token}) => delConfirm[]=${delConfirm[token]} => ${delConfirm[token] + DEL_TIMEOUT} > ${Date.now()} => ${delConfirm[token] + DEL_TIMEOUT > Date.now()}`);
	if (token) {
		// If the confirmation token is valid and is in date
		if (delConfirm[token] && delConfirm[token] + DEL_TIMEOUT > Date.now()) {
			// Allow the deletion to go through
			delete delConfirm[token];
			return true;
		}
		if (delConfirm[token] + DEL_TIMEOUT > Date.now()) {
			delete delConfirm[token];
		}
	}
	return false;
}

function commandCheck(ctx) {
	if (ctx.cmdToken === '!') { ctx.errorReply("You cannot broadcast this command."); return false; }
	if (Rooms.global.lockdown) { ctx.connection.send(`|queryresponse|leaguetool|{"err":"lockdown"}`); return false; }
	if (!ctx.user.registered) { ctx.connection.send(`|queryresponse|leaguetool|{"err":"unregistered"}`); return false; }
	return true;
}

function createTrainerID() {
	let id = require("crypto").randomBytes(4);
	let secretId = id.readUInt16LE(0);
	let trainerId = id.readUInt16LE(2);
	return [secretId, trainerId];
}

// function sendFormats(){
// 	let list = [
// 		// ValidatorRules
// 		'Nickname Clause','Item Clause','Ability Clause','-ate Clause','OHKO Clause',
// 		'Evasion Abilities Clause','Evasion Moves Clause','Moody Clause','Swagger Clause',
// 		'Baton Pass Clause','Baton Pass Speed Clause',
// 		// Battle Rules
// 		'Endless Battle Clause','Sleep Clause Mod','Freeze Clause Mod','Same Type Clause',
// 		'Mega Rayquaza Clause',
// 		'HP Percentage Mod','Exact HP Mod',
// 		//'Groundsource Mod',
// 	];
// 	this.sendReply(`|leaguetool|league-extra-formats|${JSON.stringify()}`);
// }
function getGymInfo(json){
	json = json || {};
	json.elites = {};
	json.gyms = {};
	Object.keys(LeagueSetup.elites).forEach((key)=>{
		if (LeagueSetup.elites[key].isHidden) return;
		json.elites[key] = {
			name: LeagueSetup.elites[key].name,
			types: LeagueSetup.elites[key].types,
			battletype: LeagueSetup.elites[key].battletype,
			avatar:  LeagueSetup.elites[key].avatar,
			isChamp: LeagueSetup.elites[key].isChamp,
			banlist: LeagueSetup.elites[key].banlist,
		};
	});
	Object.keys(LeagueSetup.gyms).forEach((key)=>{
		if (LeagueSetup.gyms[key].isHidden) return;
		json.gyms[key] = {
			name: LeagueSetup.gyms[key].name,
			types: LeagueSetup.gyms[key].types,
			battletype: LeagueSetup.gyms[key].battletype,
			avatar:  LeagueSetup.gyms[key].avatar,
			badge: LeagueSetup.gyms[key].badge,
			banlist: LeagueSetup.gyms[key].banlist,
			trialdesc: LeagueSetup.gyms[key].trialdesc,
		};
	});
	return json;
}

function LeagueSetupSend(msg) {
	if (!msg) return;
	if (!msg.room) msg.room = Rooms.global;
	switch (msg.type) {
	
	case 'new': {
		switch (msg.event) {
			case 'gym' : {
				if (!LeagueSetup.gyms[msg.userid]) {
					LeagueSetup.gyms[msg.userid] = {
						name: msg.username || msg.userid,
						types: [],
						battletype: 'singles',
						avatar: 167, // Questionmark Napoleon
						pending: [],
					};
					LeagueSetup.markDirty();
				}
				return LeagueSetup.gyms[msg.userid];
			}
			case 'elite': {
				if (!LeagueSetup.elites[msg.userid]) {
					LeagueSetup.elites[msg.userid] = {
						isChamp: false,
						types: [],
						battletype: 'singles',
						name: "",
						avatar: 167, // Questionmark Napoleon
						pending: [],
					};
					LeagueSetup.markDirty();
				}
				return LeagueSetup.elites[msg.userid];
			}
			case 'hallOfFame': {
				if (typeof msg.user === 'string') msg.user = Users.get(msg.user);
				let hof = LeagueSetup.hallOfFame[msg.format || 'singles'];
				let chall = LeagueSetup.challengers[msg.user.userid];
				let entry = {
					num: hof.length+1,
					name: msg.user.name,
					trainerid: chall.trainerid,
					team: msg.team,
				};
				hof.unshift(entry);
				LeagueSetup.markDirty();
				return entry;
			}
		}
	} return;
	
	case 'e4fight': {
		
		console.log(msg.otherInfo);
		
		if (!msg.p1) return msg.room.add('|html|<div class="broadcast-red">Unable to determine elite member! Tustin, you fucked it up!</div>');
		if (!msg.p2) return msg.room.add('|html|<div class="broadcast-red">Unable to determine challenger! Tustin, you fucked it up!</div>');
		if (!LeagueSetup.challengers[msg.p2]) return msg.room.add(`|error|Unable to ${msg.event} challenger: Challenger has no league challenge!`);
		let user = Users.get(msg.p2);
		let elite = Users.get(msg.p1) || {};
		if (!LeagueSetup.challengers[msg.p2].e4wins) LeagueSetup.challengers[msg.p2].e4wins = {};
		switch(msg.event) {
			case 'restart':
				// A challenger failed their e4 fight
				LeagueSetup.challengers[msg.p2].e4wins = {};
				LeagueSetup.markDirty();
				setTimeout(()=>msg.room.add(`|html|<div class="broadcast-blue">The challenger ${user.name} has lost the battle against ${elite.name}. The challenger will have to restart their Elite Four run.</div>`), 4000);
				return;
			case 'advance':
				// A challenger advanced in their e4 fight
				LeagueSetup.challengers[msg.p2].e4wins[msg.p1] = true;
				LeagueSetup.markDirty();
				let adv = "The challenger may advance to the next Elite Member!";
				if (Object.keys(LeagueSetup.challengers[msg.p2].e4wins).length >= 4) {
					adv = "The challenger is ready to challenge the League Champion!";
				}
				setTimeout(()=>msg.room.add(`|html|<div class="broadcast-blue">The challenger ${user.name} has won the battle against ${elite.name}. ${adv}</div>`), 4000);
				return;
			case 'complete': {
				// A challenger has defeated the champion and has become champion himself!
				let hof = LeagueSetup.send({
					type:"new",
					event:"hallOfFame",
					user:user,
					format: msg.otherInfo[0],
					team: msg.otherInfo[1],
				});
				
				let settings = LeagueSetup.send({type:"new", event:"elite", userid: user.userid, username: user.name});
				settings.isChamp = true;
				settings.isFormerChamp = false;
				settings.avatar = user.avatar;
				LeagueSetup.elites[elite.userid].isFormerChamp = true;
				LeagueSetup.elites[elite.userid].isHidden = true;
				
				let num = hof.num;
				num = num + (['th','st','nd','rd'][num%10]||'th');
				if (num==='11st'||num==='12nd'||num==='13rd') num=num.slice(0,2)+"th";
				setTimeout(()=>msg.room.add(`|html|<div class="broadcast-blue"><b>The challenger ${user.name} has won against ${elite.name}! Congratuations to our new ${num} TPPLeague Champion, ${user.name}!</b></div>`), 4000);
				Rooms.global.add(`|html|<div class="broadcast-blue"><b>Congratuations to our new ${num} TPPLeague Champion, ${user.name}!</b></div>`);
				BotManager.announce(`Congratuations to our new ${num} TPPLeague Champion, ${user.name}!`);
			} return;
		}
	} return;
	
	case 'champion': {
		switch (msg.event) {
			case 'prep':
				BotManager.announceNotify(`TPPLeague Champion Battle will be beginning soon!`);
				Users.users.forEach(curUser => curUser.send('|champnotify|notify') );
				return;
			case 'begin':
				BotManager.announce(`TPPLeague Champion Battle has begun! https://tppleague.me/${msg.battleid}`);
				return;
			case 'ongoing': //sent about every 10 rounds
				BotManager.announce(`TPPLeague Champion Battle is in progress! https://tppleague.me/${msg.battleid}`);
				return;
			case 'finished':
				BotManager.announce(`TPPLeague Champion Battle has completed! https://tppleague.me/${msg.battleid}`);
				Users.users.forEach(curUser => curUser.send('|champnotify|finished') );
				return;
			case 'finished-lose':
				BotManager.announce(`TPPLeague Champion Battle has completed! The Champion has defended their title! https://tppleague.me/${msg.battleid}`);
				Users.users.forEach(curUser => curUser.send('|champnotify|finished') );
				return;
		}
	} return;
	}
}
LeagueSetup.send = LeagueSetupSend; // Note: this always runs on hotpatch

exports.commands = {
	leaguetool : {
		reload : function() {
			if (!this.can('hotpatch')) return false;
			try {
				let setup = proxy(LEAGUE_CONFIG_FILE, '\t');
				LeagueSetup.dispose();
				global.LeagueSetup = setup;
				LeagueSetup.send = LeagueSetupSend;
			} catch (e) {
				if (e.name === 'SyntaxError') {
					this.errorReply("League Setup file is malformatted! Fix your JSON!");
					this.errorReply(e.message);
				} else {
					this.errorReply("Unexpected error while reloading league setup: "+e.message);
				}
				return;
			}
			return this.sendReply("The TPPLeague setup has been reloaded from disk.");
		},
		request : {
			// /leaguetool request options
			options : function(target, room, user) {
				if (!commandCheck(this)) return;
				
				let opts = [];
				if (LeagueSetup.admins.includes(user.userid)) {
					opts.push("league-admin");
				}
				opts.push("view-league");
				if (LeagueSetup.elites[user.userid]) {
					if (LeagueSetup.elites[user.userid].isChamp) {
						opts.push("league-champ");
					} else {
						opts.push("league-elite");
					}
				}
				if (LeagueSetup.gyms[user.userid]) {
					opts.push("league-gym");
				}
				if (LeagueSetup.challengers[user.userid]) {
					opts.push("league-challenge");
				} else {
					opts.push("league-challenge:new");
				}
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify( {screen:"opts", info:opts} )}`);
			},
			'league-admin': function(target, room, user) {
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let json = {
					options: LeagueSetup.options,
					elites: LeagueSetup.elites,
					gyms: LeagueSetup.gyms,
					challengers: LeagueSetup.challengers
				};
				let resp = {
					screen: 'league-admin',
					info: json,
				};
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify( resp )}`);
			},
			'league-champ': 'league-elite',
			'league-elite': function(target, room, user) {
				if (!commandCheck(this)) return;
				if (!LeagueSetup.elites[user.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let resp = {
					screen: 'league-elite',
					options: LeagueSetup.options,
					info: LeagueSetup.elites[user.userid],
					user: {
						name: this.user.name,
						avatar: this.user.avatar,
					},
				};
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify(resp)}`);
			},
			'league-gym': function(target, room, user) {
				if (!commandCheck(this)) return;
				if (!LeagueSetup.gyms[user.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let resp = {
					screen: 'league-gym',
					options: LeagueSetup.options,
					info: LeagueSetup.gyms[user.userid],
					user: {
						name: this.user.name,
						avatar: this.user.avatar,
					},
				};
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify(resp)}`);
			},
			'view-league': function(target, room, user) {
				if (this.cmdToken === '!') { this.errorReply("You cannot broadcast this command."); return false; }
				
				let resp = {
					screen: 'view-league',
					league: getGymInfo(),
				};
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify(resp)}`);
			},
			'league-challenge': function(target, room, user) {
				if (!commandCheck(this)) return;
				if (!LeagueSetup.challengers[user.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let resp = {
					screen: 'league-challenge',
					//must clone this, so we don't modify the original below
					info: Object.assign({}, LeagueSetup.challengers[user.userid]), 
					league: getGymInfo(),
					user: {
						name: this.user.name,
						avatar: this.user.avatar,
					},
				};
				// Gen 7 trainer ids: secretid + trainerid * 65536, last 6 digits
				let trid = resp.info.trainerid;
				resp.info.trainerid = String(trid[0] + trid[1] * 65536).substr(-6);
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify(resp)}`);
			},
		}, 
		'new' : {
			// /leaguetool new league-challenge - Creates a new league challenge for this user
			'league-challenge': function(target, room, user) {
				if (!commandCheck(this)) return;
				if (LeagueSetup.challengers[this.user.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"League Challenge already exists for this user."}`);
				
				LeagueSetup.challengers[user.userid] = {
					teams : {},
					badges: {},
					trainerid: createTrainerID(),
					startdate: Date.now(),
				};
				LeagueSetup.markDirty();
				
				let resp = {
					welcome: "league-challenge",
				};
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify(resp)}`);
				this.parse('/leaguetool request league-challenge');
			},
		},
		'del' : {
			// /leaguetool del league-challenge [confirmtoken] - Deletes the user's league challenge
			'league-challenge': function(target) {
				if (!commandCheck(this)) return;
				if (!LeagueSetup.challengers[this.user.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				if (!confirmToken(target)) {
					let confirmid = createToken();
					delConfirm[confirmid] = Date.now();
					return this.connection.send(`|queryresponse|leaguetool|${JSON.stringify({ confirm:confirmid, cmd:this.message })}`);
				}
				delete LeagueSetup.challengers[this.user.userid];
				LeagueSetup.markDirty();
				this.connection.send(`|queryresponse|leaguetool|{"success":"League Challenge has been forfeited successfully."}`);
				this.parse('/leaguetool request options');
			},
		},
		// /leaguetool teamcommit [type]|[oldid]|[newid]|[teamstring] - Commits a saved team.
		teamcommit : function(target, room, user) {
			if (!commandCheck(this)) return;
				
			target = target.split('|');
			let type;
			switch (target[0]) {
				case 'elite': type = "elites"; break;
				case 'gym': type = "gyms"; break;
				case 'trainer': type = "challengers"; break;
			}
			if (!LeagueSetup[type][user.userid]) return this.errorReply("Cannot commit team: unauthorized access.");
			let save = LeagueSetup[type][user.userid];
			let oldid = target[1];
			let newid = target[2];
			if (newid != oldid) {
				delete save.teams[oldid];
			}
			save.teams[newid] = target.slice(3).join('|');
			LeagueSetup.markDirty();
		},
		commit : {
			// /leaguetool commit leagueopts [json] - Sent by the Admin screen to commit league-wide options
			leagueopts : function(target){
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				try {
					let obj = JSON.parse(target);
					let save = LeagueSetup.options;
					Object.keys(obj).forEach((key)=> save[key] = obj[key] );
				} catch (e) {
					console.log("Illegal commit: "+target);
					console.log("Error: ", e);
					return this.popupReply('Illegal commit. Please use the "TPPLeague" tab. If you were using that tab, please report this error to Tustin2121.');
				}
				
				LeagueSetup.markDirty();
				this.connection.send(`|queryresponse|leaguetool|{"success":"League Options saved!"}`);
				this.parse('/leaguetool request league-admin');
			},
			// /leaguetool commit rmchal [username] [confirmtoken] - Sent by the Admin screen to remove a challenger
			rmchal : function(target){
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				target = target.split(" ");
				let other = { userid: toId(target[0]), name: target[0] };
				if (!LeagueSetup.challengers[other.userid]) {
					other = Users.get(target[0]) || { userid: toId(target[0]), name: target[0] };
				}
				if (!LeagueSetup.challengers[other.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"There is no Challenger profile for '${other.name}'"}`);
				
				if (!confirmToken(target[1])) {
					let confirmid = createToken();
					delConfirm[confirmid] = Date.now();
					return this.connection.send(`|queryresponse|leaguetool|${JSON.stringify({ confirm:confirmid, cmd:this.message })}`);
				}
				delete LeagueSetup.challengers[other.userid];
				LeagueSetup.markDirty();
				this.connection.send(`|queryresponse|leaguetool|{"success":"Challenger profile for '${other.name}' deleted!"}`);
				this.parse('/leaguetool request league-admin');
			},
			// /leaguetool commit addgym [username] - Sent by the Admin screen to add a new gymleader
			addgym : function(target){
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let other = { userid: toId(target), name: target };
				if (!LeagueSetup.gyms[other.userid]) {
					other = Users.get(target) || { userid: toId(target), name: target };
				}
				if (LeagueSetup.gyms[other.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"Gym already exists for user ${other.name}."}`);
				LeagueSetup.send({type:"new", event:"gym", userid: other.userid, username: other.name});
				this.connection.send(`|queryresponse|leaguetool|{"success":"Gym for '${other.name}' added!"}`);
				this.parse('/leaguetool request league-admin');
			},
			// /leaguetool commit rmgym [username] [confirmtoken] - Sent by the Admin screen to remove a gymleader
			rmgym : function(target){
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				target = target.split(" ");
				let other = { userid: toId(target[0]), name: target[0] };
				if (!LeagueSetup.gyms[other.userid]) {
					other = Users.get(target[0]) || { userid: toId(target[0]), name: target[0] };
				}
				if (!LeagueSetup.gyms[other.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"There is no Gym for '${other.name}'"}`);
				
				if (!confirmToken(target[1])) {
					let confirmid = createToken();
					delConfirm[confirmid] = Date.now();
					return this.connection.send(`|queryresponse|leaguetool|${JSON.stringify({ confirm:confirmid, cmd:this.message })}`);
				}
				delete LeagueSetup.gyms[other.userid];
				LeagueSetup.markDirty();
				this.connection.send(`|queryresponse|leaguetool|{"success":"Gym for '${other.name}' deleted!"}`);
				this.parse('/leaguetool request league-admin');
			},
			// /leaguetool commit addelite [username] - Sent by the Admin screen to add a new elite member
			addelite : function(target){
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let other = { userid: toId(target), name: target };
				if (!LeagueSetup.elites[other.userid]) {
					other = Users.get(target) || { userid: toId(target), name: target };
				}
				if (LeagueSetup.elites[other.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"Elite settings already exist for user ${other.name}."}`);
				LeagueSetup.send({type:"new", event:"elite", userid: other.userid, username: other.name});
				this.connection.send(`|queryresponse|leaguetool|{"success":"Elite for '${other.name}' added!"}`);
				this.parse('/leaguetool request league-admin');
			},
			// /leaguetool commit rmelite [username] [confirmtoken] - Sent by the Admin screen to remove an elite member
			rmelite : function(target){
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				target = target.split(" ");
				let other = { userid: toId(target[0]), name: target[0] };
				if (!LeagueSetup.elites[other.userid]) {
					other = Users.get(target[0]) || { userid: toId(target[0]), name: target[0] };
				}
				if (!LeagueSetup.elites[other.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"There is no Elite settings for '${other.name}'"}`);
				
				if (!confirmToken(target[1])) {
					let confirmid = createToken();
					delConfirm[confirmid] = Date.now();
					return this.connection.send(`|queryresponse|leaguetool|${JSON.stringify({ confirm:confirmid, cmd:this.message })}`);
				}
				delete LeagueSetup.elites[other.userid];
				LeagueSetup.markDirty();
				this.connection.send(`|queryresponse|leaguetool|{"success":"Elite for '${other.name}' deleted!"}`);
				this.parse('/leaguetool request league-admin');
			},
			// /leaguetool commit promotechamp [username] - Sent by the Admin screen to set an elite member as chamption
			promotechamp : function(target){
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let other = { userid: toId(target), name: target };
				if (!LeagueSetup.elites[other.userid]) {
					other = Users.get(target) || { userid: toId(target), name: target };
				}
				if (!LeagueSetup.elites[other.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"There is no Elite settings for '${other.name}"}'`);
				LeagueSetup.elites[other.userid].isChamp = true;
				LeagueSetup.markDirty();
				this.connection.send(`|queryresponse|leaguetool|{"success":"Elite '${other.name}' has been promoted to Champion!"}`);
				this.parse('/leaguetool request league-admin');
			},
			// /leaguetool commit demotechamp [username] - Sent by the Admin screen to unset am elite member as champion
			demotechamp : function(target){
				if (!commandCheck(this)) return;
				if (!LeagueSetup.admins.includes(this.user.userid)) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let other = { userid: toId(target), name: target };
				if (!LeagueSetup.elites[other.userid]) {
					other = Users.get(target) || { userid: toId(target), name: target };
				}
				if (!LeagueSetup.elites[other.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"There is no Elite settings for '${other.name}"}'`);
				LeagueSetup.elites[other.userid].isChamp = false;
				LeagueSetup.markDirty();
				this.connection.send(`|queryresponse|leaguetool|{"success":"Elite '${other.name}' has been demoted to Elite Four member!"}`);
				this.parse('/leaguetool request league-admin');
			},
			// /leaguetool commit elite {json} - Sent by the Elite settings screen to commit changed made by the screen
			elite : function(target) {
				if (!commandCheck(this)) return;
				if (!LeagueSetup.elites[this.user.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let errors = [];
				try {
					let obj = JSON.parse(target);
					let save = LeagueSetup.elites[this.user.userid];
					// Limit the values we save, and validate them on the way in.
					if (obj.name) {
						if (LeagueSetup.options.titleRename) {
							save.name = Chat.escapeHTML(obj.name.substr(0, 32));
						} else if (obj.name !== save.name) {
							errors.push("Changing of E4 titles is not allowed at this time by League Admin mandate.");
						}
					}
					if (obj.types) {
						let val = obj.types
						//TODO validate
						save.types = val; 
					}
					if (obj.bgimg) {
						let val = obj.bgimg;
						save.bgimg = Config.stadium.background().convertToId(val);
					}
					if (obj.bgmusic) {
						let val = obj.bgmusic;
						if (Config.stadium.music().isValidBattle(val)) {
							save.bgmusic = val;
						} else {
							errors.push("Background music is not valid.");
						}
					}
					if (obj.battletype) {
						let val = obj.battletype;
						if (/singles|doubles|triples/.test(val)) {
							save.battletype = val;
						} else {
							errors.push("Battle type is not valid.");
						}
					}
					if (obj.ruleset) {
						let val = obj.ruleset;
						if (Array.isArray(val) && val.every(x => typeof x == 'string')) {
							save.ruleset = val.map(x=>x.trim()).filter(x => !!x);
						} else {
							errors.push("Ruleset is invalid.");
						}
					}
					if (obj.banlist) {
						let val = obj.banlist;
						if (Array.isArray(val) && val.every(x => typeof x == 'string')) {
							save.banlist = val.map(x=>x.trim()).filter(x => !!x);
						} else {
							errors.push("Banlist is invalid.");
						}
					}
					save.avatar = this.user.avatar; //Save off the avatar for later use by others
					LeagueSetup.markDirty();
				} catch (e) {
					console.log("Illegal commit: "+target);
					console.log("Error: ", e);
					return this.popupReply('Illegal commit. Please use the "TPPLeague" tab. If you were using that tab, please report this error to Tustin2121.');
				}
				
				let repl = { success: "Settings saved!" };
				if (errors.length) {
					repl.success = "Settings saved with the following caveats:\n\n- "+errors.join("\n- ");
				}
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify(repl)}`);
				this.parse('/leaguetool request league-elite');
			},
			// /leaguetool commit gym {json} - Sent by the Gym settings screen to commit changed made by the screen
			gym : function(target) {
				if (!commandCheck(this)) return;
				if (!LeagueSetup.gyms[this.user.userid]) return this.connection.send(`|queryresponse|leaguetool|{"err":"unauthed"}`);
				
				let errors = [];
				try {
					let obj = JSON.parse(target);
					let save = LeagueSetup.gyms[this.user.userid];
					// Limit the values we save
					// Limit the values we save, and validate them on the way in.
					if (obj.name) {
						if (LeagueSetup.options.gymRename){
							save.name = Chat.escapeHTML(obj.name.substr(0, 16));
						} else if (obj.name !== save.name) {
							errors.push("Changing of gym names is not allowed at this time by League Admin mandate.");
						}
					}
					if (obj.badge) {
						if (LeagueSetup.options.badgeRename) {
							let val = obj.badge;
							if (val === 'undefined' || val === '') val = undefined;
							else val = val.replace(/[^a-zA-Z- ]/, "").substr(0, 32);
							// Check badged uniqueness
							{
								let dup = false;
								Object.keys(LeagueSetup.gyms).forEach((g)=>{
									if (val === LeagueSetup.gyms[g].badge) {
										dup = true;
									}
								});
								if (dup) {
									val = save.badge;
									errors.push("Badge name is not unique.");
								}
							}
							if (save.badge !== val) {
								let old = save.badge;
								save.badge = val;
								// Object.keys(LeagueSetup.challengers).forEach((c)=>{
								// 	if (LeagueSetup.challengers[c].badges[old] === 1) {
								// 		delete LeagueSetup.challengers[c].badges[old];
								// 		LeagueSetup.challengers[c].badges[val] = 1;
								// 	}
								// });
							}
						} else if (obj.badge !== save.badge) {
							errors.push("Changing of badge names is not allowed at this time by League Admin mandate.");
						}
					}
					if (obj.types) {
						let val = obj.types;
						//TODO validate
						save.types = val; 
					}
					if (obj.bgimg) {
						let val = obj.bgimg;
						save.bgimg = Config.stadium.background().convertToId(val);
					}
					if (obj.bgmusic) {
						let val = obj.bgmusic;
						if (Config.stadium.music().isValidBattle(val)) {
							save.bgmusic = val;
						} else {
							errors.push("Background music is not valid.");
						}
					}
					if (obj.battletype) {
						let val = obj.battletype;
						if (/singles|doubles|triples|trial/.test(val)) {
							save.battletype = val;
						} else {
							errors.push("Battle type is not valid.");
						}
					}
					if (obj.ruleset) {
						let val = obj.ruleset;
						if (Array.isArray(val) && val.every(x => typeof x == 'string')) {
							save.ruleset = val.map(x=>x.trim()).filter(x => !!x);
						} else {
							errors.push("Ruleset is invalid.");
						}
					}
					if (obj.banlist) {
						let val = obj.banlist;
						if (Array.isArray(val) && val.every(x => typeof x == 'string')) {
							save.banlist = val.map(x=>x.trim()).filter(x => !!x);
						} else {
							errors.push("Banlist is invalid.");
						}
					}
					if (obj.trialdesc) {
						var val = obj.trialdesc;
						if (val === 'undefined' || val === '') val = undefined;
						else val = val.trim().substr(0, 1000);
						save.trialdesc = val;
					}
					save.avatar = this.user.avatar; //Save off the avatar for later use by others
					LeagueSetup.markDirty();
				} catch (e) {
					console.log("Illegal commit: "+target);
					console.log("Error: ", e);
					return this.popupReply('Illegal commit. Please use the "TPPLeague" tab. If you were using that tab, please report this error to Tustin2121.');
				}
				
				let repl = { success: "Settings saved!" };
				if (errors.length) {
					repl.success = "Settings saved with the following caveats:\n\n- "+errors.join("\n- ");
				}
				this.connection.send(`|queryresponse|leaguetool|${JSON.stringify(repl)}`);
				this.parse('/leaguetool request league-gym');
			},
		},
	},
	leaguetoolhelp : [
		'/leaguetool - Command used internally by the Adventure Builder. Use the "TPPLeague" tab instead.',
	],
	
	pendingchallenges : function(target) {
		if (this.cmdToken === '!') return this.errorReply('You cannot broadcast this command.');
		let silent = (target === 'silent');
		// if (Rooms.global.lockdown) return this.errorReply('The server is in lockdown. You cannot hand out badges at this time.');
		if (!this.user.registered) {
			if (!silent) this.errorReply('Please log in first.');
			return;
		}
		
		let gym = LeagueSetup.gyms[this.user.userid];
		if (gym) {
			if (gym.pending.length) {
				this.sendReply("Challengers waiting to fight your gym: "+gym.pending.join(","));
			} else if (!silent) {
				this.sendReply("There are no challengers waiting to fight your gym right now.");
			}
		}
		
		gym = LeagueSetup.elites[this.user.userid];
		if (gym) {
			if (gym.pending.length) {
				this.sendReply("Challengers waiting to fight your E4 team: "+gym.pending.join(","));
			} else if (!silent) {
				this.sendReply("There are no challengers waiting to fight your E4 team right now.");
			}
		}
	},
	pendingchallengeshelp : [
		'/pendingchallenges - Show any pending challenges you have.',
	],
	
	givebadge : function(target) {
		if (this.cmdToken === '!') return this.errorReply('You cannot broadcast this command.');
		if (Rooms.global.lockdown) return this.errorReply('The server is in lockdown. You cannot hand out badges at this time.');
		if (!this.user.registered) return this.errorReply('Please log in first.');
		if (!LeagueSetup.options.badgeGive) return this.errorReply("No badges are allowed to be handed out at this time, by League Administration mandate.");
		
		let gym = LeagueSetup.gyms[this.user.userid];
		if (!gym && !LeagueSetup.admins.includes(this.user.userid)) {
			return this.errorReply("You are not a registered gym leader.");
		}
		let badge = gym.badge;
		let other = null;
		let admin = "";
		if (this.room.battle) {
			if (!this.room.battle.ended) return this.errorReply(`But the battle in this room isn't finished!`);
			if (this.room.battle.format === 'tppleaguegym' && this.room.battle.p1 === this.user) {
				other = this.room.battle.p2;
			}
		}
		if (!other) {
			if (!target) return this.errorReply(`No target user.`);
			let b = this.splitTarget(target);
			if (!this.targetUser) return this.errorReply(`User is not online to recieve their badge.`);
			other = this.targetUser;
			if (b) {
				if (LeagueSetup.admins.includes(this.user.userid)) {
					badge = b;
					admin = ", on behalf of the League Administration,";
				} else {
					return this.errorReply("Only League Administrators can hand out arbitrary badges.");
				}
			}
		}
		if (!badge) {
			return this.errorReply(`You have not defined a badge for your gym.`);
		}
		if (Date.now() < (gym.lastBadgeGivenTime || 0)+1000*60*6){ // 6 minnutes
			return this.errorReply(`You are giving out badges too quickly. Legit fights do not last 30 seconds after all.`);
		}
		if (other === this.user || other.userid === this.user.userid) {
			return this.errorReply('You cannot give your own badge to yourself, cheater.');
		}
		
		let challenge = LeagueSetup.challengers[other.userid];
		if (!challenge) {
			// other.sendTo(this.room, `|html|<div class="message-error">${this.user.name} is attempting to give you a TPPLeague badge, but you do not have a TPPLeague challenge set up to recieve the badge. If you wish to recieve this badge, please user the TPPLeague button on the main menu to begin a league challenge.</div>`);
			return this.errorReply(`${other.name} does not have a TPPLeague challenge set up. Cannot give badge.`);
		}
		if (challenge.badges[badge]) {
			return this.errorReply(`${other.name} already owns the ${badge} Badge.`);
		}
		gym.lastBadgeGivenTime = Date.now();
		challenge.badges[badge] = 1;
		LeagueSetup.markDirty();
		this.add(`|html|<div class="infobox badgeget" for="${other.userid}" style="text-align:center;"><p style='font-weight:bold;'>${this.user.name}${admin} presents ${other.name} with the ${badge} Badge!</p><img src="/badges/${badge}.png" width="80" height="80"/></div>`);
		other.send(`|badgeget|${badge}`);
		this.parse('/savereplay silent');
	},
	givebadgehelp: [
		'/givebadge [user] - If you are a gym leader, gives your gym badge to the named user. User must be present.',
	],
};