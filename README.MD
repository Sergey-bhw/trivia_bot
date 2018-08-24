### Simple trivia bot for discord

Has 3 commands (if % is your prefix then):

%start [optional category ID or difficulty (easy/medium/hard)] - start trivia game  
%stop - start trivia game (requires trivia role or manage channels permission)  
%categories - list of available categories  

In order to use this bot (and host it yourself) you need to create `config.json` file inside `inc` directory with you app user token and desired prefix like this:

{  
	"prefix": "%",  
	"token": "NDc4MLU5MTc1MTIyMjg4Fjgw.DlGpyQ.-6KyJgNQdycudenivIBCQY_9Xh0",  
}  

then you can invite your bot to a server with invite link like this one:  
https://discordapp.com/api/oauth2/authorize?client_id=--CLIENT_ID_OF_YOUR_BOT--&scope=bot&permissions=0