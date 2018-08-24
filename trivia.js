let Discord    = require('discord.js');
let bot        = new Discord.Client();
let needle     = require('needle');
let path       = require("path");
let _          = require('lodash');
let decode     = require('ent').decode;

let config = require(path.join(__dirname, 'inc', 'config.json'));

let prefix = config.prefix;

bot.login(config.token);

bot.on('ready', () => {
	console.log((new Date()) + ' Trivia bot started');
	bot.user.setPresence({ game: { name: `${prefix}help to see commands`, type: 0 } });
});

let guildsData = {};

bot.on('message', message => {
	let g = guildsData[message.guild.id];
	const usedPref = message.content.slice(0, 1);
	if(message.author.bot || message.channel.type == 'dm') return;

	//tracking each message for answers
	if(g && g.tracking){
		let pattern = /^([a|b|c|d])\b/i;
		if(message.content.match(pattern) && g.answerTyped.indexOf(message.author.username) == -1){
			g.answerTyped.push(message.author.username);
			let letter = message.content.match(pattern)[1].toUpperCase();
			let lettersNum = {'A':0, 'B':1, 'C':2, 'D':3}; //mapping letters to answer array indexes
			let guessed = g.toCheck.some(elem => {return elem[0] == g.toCheck[lettersNum[letter]][0] && elem[1]});
			if(guessed){
				if(!g.points[message.author.username]){
					g.points[message.author.username] = 1;
				}
				else g.points[message.author.username] += 1
				g.guessedOnes.push(message.author.username);
			}
		}
	}

	if(usedPref != prefix) return

	
	const args = message.content.slice(prefix.length).trim().split(/\s+/g);
	const command = args.shift().toLowerCase();

	switch (command){
		case 'help':
			var help = [
				`My commands:`,
				`${prefix}start [optional category ID or difficulty (easy/medium/hard)] - start trivia game`,
				`${prefix}stop - start trivia game (requires trivia role or manage channels permission)`,
				`${prefix}categories - list of available categories`
			];
			message.channel.send('```' + help.join('\n') + '```');
			break;
		case 'start':
			if(g && g.timeout && !g.timeout._called){
				message.channel.send(`There is an active game already`);
			}else{
				needle.get('https://opentdb.com/api_token.php?command=request', (err, res) => {
					guildsData[message.guild.id] = {
						token: res.body.token,
						tracking: false,
						answerTyped: [],
						guessedOnes: [],
						waitForAnswer: 25000,
						toCheck: [],
						points: {},
						timeout: false,
						stopPoint: 2,
						missedRounds: 0
					}
					if(err){
						console.log('Error in trivia api: ' + err);
						return;
					}
					processWithToken(message, args);
				});
			}
			break;
		case 'stop':
			if(g && g.timeout && !g.timeout._called){
				if(hasRole('Trivia', message.member) || message.member.hasPermission('MANAGE_CHANNELS')){
					clearTimeout(g.timeout);
					g.tracking = false;
					g.toCheck = [];
					g.answerTyped = [];
					g.guessedOnes = [];
					g.timeout = false;
					message.channel.send(`**Trivia stopped**`);
				}else{
					message.channel.send(`You should have \`Trivia\` role or \`manage channels\` permission to use this command`);
				}
			}else{
				message.channel.send(`No active trivia game at the moment`);
			}
			break;
		case 'categories':
			needle.get('https://opentdb.com/api_category.php', (err, res) => {
				let categories = res.body.trivia_categories;
				needle.get('https://opentdb.com/api_count_global.php', (err, res) => {
					categories = categories.map(cat => { //combining with questions count
						cat.count = res.body.categories[cat.id].total_num_of_verified_questions;
						return cat;
					});
					categories = _.orderBy(categories, ['name']).map(cat => {return `**${cat.name}**: ${cat.count} questions, ID:${cat.id}`}).join('\n'); //making a string
					message.channel.send(categories);
				});
			});
			break;
	};
})

function processWithToken(message, args = []){
	let g = guildsData[message.guild.id];
	let token = g.token;

	let catRegex = /^[0-9]{1,3}$/;
	let diffRegex = /^easy|medium|hard$/i;
	let url = `https://opentdb.com/api.php?amount=1&type=multiple&token=${token}`;
	if(args[0] && args[0].match(catRegex)){ // if category provided
		let cat = args[0].match(catRegex)[0];
		url = `https://opentdb.com/api.php?amount=1&type=multiple&category=${cat}&token=${token}`;
	}else if(args[0] && args[0].match(diffRegex)){ // if difficulty provided
		let diff = args[0].match(diffRegex)[0].toLowerCase();
		url = `https://opentdb.com/api.php?amount=1&type=multiple&difficulty=${diff}&token=${token}`;
	}

	needle.get(url, (err, res) => {
		if(err){
			console.log('Error 2 in trivia api: ' + err);
			return;
		}
		if(!res.body.results.length){
			message.channel.send('Cannot start, probably wrong category ID specified');
			return;
		}
		let json = res.body.results[0];
		let desc = `Category: _${json.category}_\nDifficulty: _${json.difficulty}_\n`;
		let answers = _.shuffle([...json.incorrect_answers.map(elem => {return [decode(elem), false]}), [decode(json.correct_answer), true]]);
		//console.log(answers); //answers logging
		let toSend = {embed: {
			color: 3447003,
			title: decode(json.question),
			"description": desc,
			fields: [
				{
					name: "A",
					value: answers[0][0],
					inline: true
				},
				{
					name: "B",
					value: answers[1][0],
					inline: true
				},
				{
					name: "\u200B",
					value: '\u200B'
				},
				{
					name: "C",
					value: answers[2][0],
					inline: true
				},
				{
					name: "D",
					value: answers[3][0],
					inline: true
				}
			]
		}};
		message.channel.send(toSend);
		g.tracking = true;
		g.toCheck = answers;
		g.timeout = setTimeout(() => {
			g.tracking = false;
			let fields = [];
			for(let key in g.points){
				fields.push({name: key, value: g.points[key]});
			}
			if(!fields.length) fields.push({name: 'none', value: "\u200B"});
			let color = g.guessedOnes.length ? 65304 : 16711686;
			let embed = {embed: {
				color,
				title: `Correct answer: **${json.correct_answer}**`,
				"description": `Answered: ${g.guessedOnes.length ? g.guessedOnes.join(', ') : 'nobody'}\n_Current points:_`,
				fields
			}};
			message.channel.send(embed)
			.then(() => {
				if(!g.answerTyped.length){
					g.missedRounds += 1;
				}
				if(g.missedRounds >= g.stopPoint){
					message.channel.send(`No one is playing anymore, stopping the game...`);
				}else{
					g.toCheck = [];
					g.answerTyped = [];
					g.guessedOnes = [];
					processWithToken(message);
				}
			})
			.catch(()=>{});
		}, g.waitForAnswer);
	});
}

function hasRole(nameOrID, member){
	for(let role of member.roles){
		if(Array.isArray(nameOrID)){ //if array of role ID's
			if(nameOrID.indexOf(role[1].id) != -1) return true;
		}else{ //if single role ID or role Name
			if(role[1].name == nameOrID || role[1].id == nameOrID){
				return true;
			}
		}
	}
	return false;
};