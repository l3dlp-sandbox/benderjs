/**
 * Copyright (c) 2014-2015, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 *
 * @file Runner code for captured browsers
 */

/* global io */

( function() {
	'use strict';

	var statusEl = document.getElementById( 'status' ),
		statusLabel = statusEl.getElementsByTagName( 'span' )[ 0 ],
		selectEl = statusEl.getElementsByTagName( 'select' )[ 0 ];

	function Bender( socket ) {
		var contextEl = document.getElementById( 'context' ),
			that = this,
			runs = 0,
			testTimeout,
			testWindow,
			lastError;

		this.running = false;
		this.results = null;
		this.current = null;
		this.config = window.BENDER_CONFIG;

		this.runAsChild = true;

		function clearTestTimeout() {
			if ( testTimeout ) {
				clearTimeout( testTimeout );
			}
		}

		function handleTimeout() {
			var result = {
				name: that.current,
				error: 'Script error',
				success: false
			};

			that.result( JSON.stringify( result ) );
			that.complete( '{"duration":0}' );
		}

		function resetTestTimeout( timeout ) {
			if ( !timeout ) {
				return;
			}

			clearTestTimeout();

			testTimeout = setTimeout( handleTimeout, timeout );
		}

		function handleRun( data ) {
			if ( !data ) {
				return;
			}

			data.results = {};
			that.results = data;
			that.running = true;

			that.run( data.id[ 0 ] === '/' ? data.id : '/' + data.id );
		}

		function addFrame( id ) {
			var frame = document.createElement( 'iframe' );

			frame.className = 'context-frame';
			frame.src = id;
			contextEl.appendChild( frame );
		}

		function removeFrame() {
			var frame = contextEl.getElementsByTagName( 'iframe' )[ 0 ];

			contextEl.className = '';

			if ( frame ) {
				frame.src = 'about:blank';
				contextEl.removeChild( frame );
			}
		}

		this.error = function( error ) {
			lastError = JSON.parse( error );
			socket.emit( 'err', lastError );
		};

		this.result = function( result ) {
			result = JSON.parse( result );

			if ( !result.success && lastError ) {
				result.error += '\n\n' + lastError;
				lastError = null;
			}

			this.results.results[ result.name ] = result;

			socket.emit( 'result', result );

			resetTestTimeout( that.config && that.config.testTimeout );
		};

		this.ignore = function() {
			this.results.success = true;
			this.results.ignored = true;
			this.results.duration = 0;
			this.complete( '{"duration":0}' );
		};

		this.next = this.complete = function( result ) {
			var parsed = JSON.parse( result );

			clearTestTimeout();

			this.results.duration = parsed.duration;
			this.results.coverage = parsed.coverage;

			this.results.success = parsed.success || (
				parsed.failed === 0 &&
				parsed.errors === 0 &&
				( parsed.passed > 0 || parsed.ignored > 0 )
			);

			socket.emit( 'complete', this.results );

			if ( !bender.env.ie ) {
				removeFrame();
			}

			this.running = false;
			this.results = null;
			this.current = null;
		};

		this.log = function() {
			socket.emit( 'log', Array.prototype.join.call( arguments, ' ' ) );
		};

		this.run = function( id ) {
			if ( typeof id !== 'string' ) {
				return;
			}

			this.current = id;

			runs++;

			id += '#child';

			if ( bender.env.ie ) {
				if ( runs >= 20 && testWindow ) {
					testWindow.close();
					setTimeout( function() {
						runs = 0;
						testWindow = window.open( id, 'bendertest' );
					}, 300 );
				} else {
					if ( !testWindow || testWindow.closed ) {
						testWindow = window.open( id, 'bendertest' );
					} else {
						if ( id === testWindow.location.href.split( testWindow.location.host )[ 1 ] ) {
							testWindow.location.reload();
						} else {
							testWindow.location.href = id;
						}
					}
				}
			} else {
				removeFrame();
				addFrame( id );
			}

			resetTestTimeout( that.config && that.config.testTimeout );
		};

		this.stop = function() {
			// close everything on disconnect
			if ( this.running ) {
				this.running = false;

				if ( bender.env.ie && testWindow ) {
					testWindow.close();
					testWindow = null;
				} else {
					removeFrame();
				}
			}
		};

		this.maximize = function() {
			resetTestTimeout( that.config && that.config.manualTestTimeout );
		};

		socket
			.on( 'connect', function() {
				var id = /\/clients\/([^\/#]+)/.exec( window.location )[ 1 ];

				// register a client
				socket.emit( 'register', {
					id: id,
					ua: navigator.userAgent,
					mode: mode
				}, function( passed ) {
					// force a client to reconnect with new UUID
					if ( !passed ) {
						var mode = window.location.hash ? '/' + window.location.hash.substr( 1 ) : '';
						window.location.pathname = '/capture' + mode;
					}
				} );
			} )
			.on( 'disconnect', function() {
				that.stop();
				clearTestTimeout();
			} )
			.on( 'run', handleRun );
	}

	function setStatus( connect ) {
		return function() {
			statusLabel.innerHTML = connect ? 'Connected' : 'Disconnected';
			statusEl.className = connect ? 'ok' : 'fail';
		};
	}

	function addListener( target, event, handler ) {
		if ( target.addEventListener ) {
			target.addEventListener( event, handler, false );
		} else if ( target.attachEvent ) {
			target.attachEvent( 'on' + event, handler );
		} else {
			target[ 'on' + event ] = handler;
		}
	}

	function changeMode( event ) {
		event = event || window.event;

		var target = event.target || event.srcElement,
			mode = target.options[ target.selectedIndex ].value;

		window.location.hash = mode;
		window.location.reload();
	}

	function setMode( mode ) {
		var options = selectEl.options,
			i;

		for ( i = 0; i < options.length; i++ ) {
			if ( options[ i ].value === mode ) {
				selectEl.selectedIndex = i;

				return;
			}
		}
	}

	var socket = io.connect( '/client', {
		'reconnection delay': 2000,
		'reconnection limit': 2000,
		'max reconnection attempts': Infinity
	} );

	// handle socket connection status
	socket
		.on( 'connect', setStatus( true ) )
		.on( 'disconnect', setStatus() );

	var env = window.bender.env;
	window.bender = new Bender( socket );
	window.bender.env = env;

	addListener( window, 'unload', function() {
		socket.disconnect();
	} );

	var mode = window.location.hash && window.location.hash.substr( 1 );

	if ( mode !== 'unit' && mode !== 'manual' && mode !== 'all' ) {
		mode = 'unit';
	}

	setMode( mode );

	addListener( selectEl, 'change', changeMode );
} )();
