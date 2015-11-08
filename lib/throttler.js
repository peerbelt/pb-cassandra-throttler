// Copyright 2015, Peer Belt Inc 
// All rights reserved.
// 
// Redistribution and use of this Material or portions of it in source and/or 
// binary form, with or without modifications, is limited exclusively to Peer
// Belt Inc (The Company). The Company has exclusive ownership rights with 
// respect to any derivative work produced including this source code document. 
// Such work may not be used for any purpose other than the benefit of 
// The Company, and no copies thereof may be retained without explicit written 
// consent of Peer Belt Inc.

// the throttler library
var Client = require( "node-rest-client" ).Client;

"uses strict";

var threshold = { stop: 6.00, resume: 4.50, deadTolerance: 1 };

Client.prototype.get2 = function( url, cb ) {
	if ( typeof cb !== "function" ) return;
	this.get( url, function( data, response ) { cb( undefined, data, response ); } ).on( "error", cb );
};

var getOneClusterName = function( cb ) {
	var self = this;
	self._client.get2( "http://" + self._opsCenterHost + "/cluster-configs", function( er, data, response ) {
		for( var cn in ( data || {} ) ) {
			self._clusterName = cn;
			break;
		};
		if ( ( !self._clusterName ) && ! er ) {
			er = new Error( "No cluster name. Unexpected at this point." );
		}
		cb && cb( er, self ); 
	} );
};

var getLoadStats = function( cb ) {
	var self = this;
	self._client.get2( "http://" + self._opsCenterHost + "/" + self._clusterName + "/nodes", function( er, data, response ) {
		// get the nodes
		var node, nodeState, deadNodes = 0, canContinue = true;
		while( data && data.pop && ( node = data.pop() ) ) {
			if ( !( nodeState = self._nodes[ node.node_ip ] ) ) {
				self._nodes[ node.node_ip ] = nodeState =  {};
			}
			if ( nodeState.dead && !node.last_seen ) {
				delete nodeState.dead;
			}
			nodeState.load = node.load;
			if ( node.last_seen ) {
				nodeState.dead = 1;
				if ( ++deadNodes > threshold.deadTolerance ) {
					canContinue = false;
				}
			}
			if ( nodeState.swamped ) {
				if ( node.load >= threshold.resume ) {
					canContinue = false;
				}
				else {
					delete nodeState.swamped;
				}
			}
			if ( node.load >= threshold.stop ) {
				nodeState.swamped = 1;
			}
		}
		self._canContinue = canContinue;
		if ( canContinue ) {
			var i = 0, ar = self._paused, l = ar.length, cb2;
			for( ; i < l; i++ ) {
				setImmediate( ar[ i ] );
			}
			if ( l ) {
				self._paused = [ ];
			}			
		}
		cb && cb( er, self, response );
	} );
};

var Throttler = function( ) {
	var self = this, args = Array.prototype.slice.apply( arguments ), cb;
	if ( typeof args[ args.length - 1 ] === "function" ) {
		cb = args.pop();
	}
	var opsCenterHost = args[ 0 ], clusterName = args[ 1 ], ipMap = args[ 2 ];
	var hookInfoLoop = function( er ) {
		if ( !er ) {
			var boundLoadStats;
			self._intervalId = setInterval( boundLoadStats = getLoadStats.bind( self ), 1000 );
			boundLoadStats( cb );
		}
		else {
			cb && setImmediate( cb, er, self );
		}
	}; 
	( ( self._opsCenterHost = ( opsCenterHost || process.env.OPSCENTER_HOST || "localhost" ) ).indexOf( ":" ) === -1 ) && 
	  ( self._opsCenterHost = ( self._opsCenterHost + ":" + ( process.env.OPSCENTER_PORT || "8888" ) ) );
	self._ipMap = ipMap;
	self._client = new Client();
	self._nodes = { };
	self._paused = [];
	if ( !( self._clusterName = clusterName ) ) {
		getOneClusterName.bind( this )( hookInfoLoop );
	}
	else {
		hookInfoLoop( );
	}
	return self;
};

Throttler.prototype.stopListen = function( ) {
	var self = this;
	if ( self._intervalId ) {
		clearInterval( self._intervalId );
		delete self._intervalId;
	}
}

Throttler.prototype.throttle = function( continuation ) {
	if ( typeof continuation === "function" )  {
		var self = this;
		if ( self._canContinue ) {
			setImmediate( continuation );
		}
		else {
			self._paused.push( continuation );
		}
	}
};

Throttler.prototype.nodes = function( ) {
	return this._nodes;
};

module.exports = Throttler;