var request = require('request');
var TelegramBot = require('node-telegram-bot-api');
var token = '212143579:AAGxYRyHdAVfbOXq55e0XRS3zKEc-smop-4';

SR = {}; // search results

/* database*/
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/news-alert-bot');
var db = mongoose.connection;
db.on('error', function (err) {
    console.error('connection error:', err.message);
});
db.once('open', function callback () {
    console.info("Connected to DB!");
});
var Schema = mongoose.Schema;
var CompanyShema = new Schema({
    chat_id : { type: String, required: true },
    name : { type: String, required: true }
});
var Company = mongoose.model('Company', CompanyShema);
var botOptions = {
    polling: true
};

/*Bot*/
var bot = new TelegramBot(token, botOptions);
bot.getMe().then(function(me)
{
    console.log('Hello! My name is %s!', me.first_name);
    console.log('My id is %s.', me.id);
    console.log('And my username is @%s.', me.username);
});

bot.on('text', function(msg)
{
    var messageChatId = msg.chat.id;
    var messageText = msg.text.split('?');
    var messageDate = msg.date;
    var messageUsr = msg.from.username;

    var command = messageText[0];
    switch(command){
        case '/start':
            sendMessageByBot(messageChatId, 'Hello!');
            break;
        case '/add':
            if(!messageText[1] || messageText[1].length == 0){
                sendMessageByBot(messageChatId, 'You did\'t enter company');
                break;
            }
            request({
                uri: 'http://d.yimg.com/autoc.finance.yahoo.com/autoc?query=' + messageText[1] + '&region=as&lang=en',
                method: 'get'
            }, function (error, response, body) {
                var res= JSON.parse(body);
                if(res.ResultSet.Result.length == 0)
                    sendMessageByBot(messageChatId, 'Invalid name.');
                else{
                    var company = new Company({
                        chat_id: messageChatId,
                        name: res.ResultSet.Result[0].name
                    });
                    company.save(function(err){
                        if(err){
                            console.log(err);
                            sendMessageByBot(messageChatId, 'Sorry! Something go wrong:( Try again');
                        }
                        else{
                            sendMessageByBot(messageChatId, 'Success!');
                        }
                    })
                }

            });
            break;
        case '/remove':
            if(!messageText[1] || messageText[1].length == 0)
                sendMessageByBot(messageChatId, 'You don\'t enter company');
            Company.findOne({
                chat_id: messageChatId,
                name: messageText[1]
            }).then(function (company, err) {
                if(company){
                    company.remove().then(function(){
                        sendMessageByBot(messageChatId, 'Successfully deleted');
                    })
                }
                else {
                    console.log(err);
                    sendMessageByBot(messageChatId, 'Something go wrong:( Are you sure that you have entered the correct name of the company?');
                    Company.find({
                        chat_id: messageChatId
                    })
                        .exec(function(err, items){
                            var res = 'Your companies:\n';
                            items.forEach(function (company) {
                                res += company.name + '\n';
                            });
                            sendMessageByBot(messageChatId, res);
                        })
                }

            });
            break;
        case '/search':
            if(messageText[1] && messageText[1].length != 0){
                request({
                    uri: 'http://d.yimg.com/autoc.finance.yahoo.com/autoc?query=' + messageText[1] + '&region=as&lang=en',
                    method: 'get'
                }, function (error, response, body) {
                    var res= JSON.parse(body);
                    if(res.ResultSet.Result.length == 0)
                        sendMessageByBot(messageChatId, 'Invalid name.');
                    else {
                        BingSearch(messageChatId, res.ResultSet.Result[0].name);
                    }
                })
            }
            else{
                Company.find({
                    chat_id: messageChatId
                })
                    .exec(function(err, items){
                        if (err) {
                            console.log(err);
                            sendMessageByBot(messageChatId, 'Sorry! Something go wrong:( Try again');
                        }
                        if(items.length == 0)
                            sendMessageByBot(messageChatId, 'You don\'t add companies');
                        else{
                            items.forEach(function (company) {
                                BingSearch(messageChatId, company.name);
                            })
                        }


                    });
            }
            break;
        case '/view':
            if(!messageText[1] || messageText[1].length == 0)
                sendMessageByBot(messageChatId, 'You didn\'t enter id');
            var news = SR[messageChatId][messageText[1] - 1];
            var res = '';
            if(!news)
                sendMessageByBot(messageChatId, "TYou enter wrong news id");
            else {
                res += news.name + '\n' + news.url;
                sendMessageByBot(messageChatId, res);
            }
            break;
        case '/help':
        default:
            var list = 'Commands list:\n' +
                        '/add?param - add company to list. \'param\' could be company name or NASDAQ code\n' +
                        '/remove?param - remove company from list. \'param\' could be company name or NASDAQ code\n' +
                        '/search - search news for companies from list\n' +
                        '/view?param - view link to an article. \'param\' is a number of artilce from news list formed by /search command\n' +
                        '/search?param - search news for a company. \'param\' could be company name or NASDAQ code';
            sendMessageByBot(messageChatId, list);
            break;
    }
    //console.log(msg);
});

function sendMessageByBot(aChatId, aMessage)
{
    bot.sendMessage(aChatId, aMessage, { caption: 'I\'m a cute bot!' });
}

function BingSearch(chatId,param) {
    var index = 1;
    SR[chatId] = [];
    request({
        headers: {
            "Ocp-Apim-Subscription-Key": '282cd2d77340489f89d6d48afd6a7d25'
        },
        uri: 'https://bingapis.azure-api.net/api/v5/news/search?q=' + param +'&count=3&offset=0&mkt=en-us&safeSearch=Moderate',
        method: 'get'
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var response = JSON.parse(body);
            var res = param +  '\n';
            if(response.value.length == 0){
                sendMessageByBot(chatId, 'No news found');
            }
            else {
                response.value.forEach(function(item){
                    SR[chatId].push(item);
                    res += index + ') ' + item.name + '\n';
                    index++;
                });
                sendMessageByBot(chatId, res);
            }

        }
        else {
            console.warn(error);
        }
    })
}