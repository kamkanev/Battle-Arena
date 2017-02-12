//var mongojs = require("mongojs");
var db = null;//mongojs('localhost:27017/myGame', ['account','progress']);

var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

var SOCKET_LIST = {};

var Entity = function(param){
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
        map:"cave",
	}
    if(param){
        if(param.x)
            self.x = param.x;
        if(param.y)
            self.y = param.y;
        if(param.map)
            self.map = param.map;
        if(param.id)
            self.id = param.id;
    }
        
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
	}
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
	}
	return self;
}

var Player = function(param){
	var self = Entity(param);
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
    self.pressingSpace = false;
    self.pressingQ = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;
	self.hp = 10;
	self.hpMax = 10;
	self.score = 0;
	
	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		super_update();
		
        //attack
        
		if(self.pressingAttack){
            if(self.pressingSpace){
            for(var i=0;i<=1;i++)
			self.shootBullet(i*10+self.mouseAngle);
            }else{
                i=0;
                self.shootBullet(i*10+self.mouseAngle);
            }
            if(self.pressingQ){
            for(var i=-3;i<=3;i++)
			self.shootBullet(i*10+self.mouseAngle);
            }else{
                i=0;
                self.shootBullet(i*10+self.mouseAngle);
            }
		}
	}
	self.shootBullet = function(angle){
		Bullet({
            parent:self.id,
            angle:angle,
            x:self.x,
            y:self.y,
            map:self.map,
        });
		
	}
	
	self.updateSpd = function(){
		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;
		
		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;		
	}
	
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,	
			number:self.number,	
			hp:self.hp,
			hpMax:self.hpMax,
			score:self.score,
            map:self.map,
		};		
	}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			hp:self.hp,
			score:self.score,
		}	
	}
	
	Player.list[self.id] = self;
	
	initPack.player.push(self.getInitPack());
	return self;
}
Player.list = {};
Player.onConnect = function(socket){
    var map = 'cave';
    if(Math.random()<0.5)
        map = 'forest';
	var player = Player({
        id:socket.id,
        map:map,
    });
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
        else if(data.inputId === 'space')
            player.pressingSpace = data.state;
        else if(data.inputId === 'q')
            player.pressingQ = data.state;
	});
	
	socket.emit('init',{
		selfId:socket.id,
		player:Player.getAllInitPack(),
		bullet:Bullet.getAllInitPack(),
	})
}
Player.getAllInitPack = function(){
	var players = [];
	for(var i in Player.list)
		players.push(Player.list[i].getInitPack());
	return players;
}

Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	removePack.player.push(socket.id);
}
Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push(player.getUpdatePack());		
	}
	return pack;
}


var Bullet = function(param){
	var self = Entity(param);
	self.id = Math.random();
    self.angle = param.angle;
	self.spdX = Math.cos(param.angle/180*Math.PI) * 10;
	self.spdY = Math.sin(param.angle/180*Math.PI) * 10;
	self.parent = param.parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();
		
		for(var i in Player.list){
			var p = Player.list[i];
			if(self.map == p.map && self.getDistance(p) < 32 && self.parent !== p.id){
				p.hp -= 1;
								
				if(p.hp <= 0){
					var shooter = Player.list[self.parent];
					if(shooter)
						shooter.score += 1;
					p.hp = p.hpMax;
					p.x = Math.random() * 500;
					p.y = Math.random() * 500;					
				}
				self.toRemove = true;
			}
		}
	}
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,	
            map:self.map,
		};
	}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,		
		};
	}
	
	Bullet.list[self.id] = self;
	initPack.bullet.push(self.getInitPack());
	return self;
}
Bullet.list = {};

Bullet.update = function(){
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove){
			delete Bullet.list[i];
			removePack.bullet.push(bullet.id);
		} else
			pack.push(bullet.getUpdatePack());		
	}
	return pack;
}

Bullet.getAllInitPack = function(){
	var bullets = [];
	for(var i in Bullet.list)
		bullets.push(Bullet.list[i].getInitPack());
	return bullets;
}

var DEBUG = true;

var isValidPassword = function(data,cb){
    return cb(true);
	/*db.account.find({username:data.username,password:data.password},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});*/
}
var isUsernameTaken = function(data,cb){
    return cb(false);
	/*db.account.find({username:data.username},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});*/
}
var addUser = function(data,cb){
    return cb();
	/*db.account.insert({username:data.username,password:data.password},function(err){
		cb();
	});*/
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	socket.on('signIn',function(data){
		isValidPassword(data,function(res){
			if(res){
				Player.onConnect(socket);
				socket.emit('signInResponse',{success:true});
			} else {
				socket.emit('signInResponse',{success:false});			
			}
		});
	});
	socket.on('signUp',function(data){
		isUsernameTaken(data,function(res){
			if(res){
				socket.emit('signUpResponse',{success:false});		
			} else {
				addUser(data,function(){
					socket.emit('signUpResponse',{success:true});					
				});
			}
		});		
	});
	
	
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	socket.on('sendMsgToServer',function(data){
		var playerName = ("" + data.username);
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',playerName + ': ' + data.msg);
		}
	});
	
	socket.on('evalServer',function(data){
		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);		
	});
	
	
	
});

var initPack = {player:[],bullet:[]};
var removePack = {player:[],bullet:[]};


setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init',initPack);
		socket.emit('update',pack);
		socket.emit('remove',removePack);
	}
	initPack.player = [];
	initPack.bullet = [];
	removePack.player = [];
	removePack.bullet = [];
	
},1000/25);










