/**
 * Copyright (c) 2014-2015, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 *
 * @file Manages application resources required by tests
 */

'use strict';

var path = require( 'path' ),
	util = require( 'util' ),
	fs = require( 'graceful-fs' ),
	Collection = require( './collection' ),
	logger = require( './logger' ).create( 'applications', true );

/**
 * Application manager
 * @module applications
 */
module.exports = {

	name: 'applications',

	attach: function() {
		var bender = this;

		bender.checkDeps( module.exports.name, 'conf', 'files' );

		logger.debug( 'attach' );

		/**
		 * Application constructor
		 * @param {String}         name            Application name
		 * @param {Object}         options         Configuration object
		 * @param {String}         [options.proxy] URL to proxy into
		 * @param {String}         [options.path]  Local directory
		 * @param {String}         options.url     Application's URL
		 * @param {Array.<String>} options.files   Application's files to be loaded in test context
		 * @memberOf module:applications
		 * @constructor
		 */
		function Application( name, options ) {
			this.name = name;

			if ( options.proxy ) {
				this.proxy = options.proxy;
			}

			if ( options.path ) {
				this.path = options.path;
				this.ignore = options.ignore || null;
				this.checkPath();
			}

			this.url = path.normalize( ( options.url || this.name ) + '/' ).split( path.sep ).join( '/' );

			this.buildFiles( options.files );
		}

		/**
		 * Check if the path to the application exists and points to a directory.
		 * Throw an error if anything goes wrong.
		 */
		Application.prototype.checkPath = function() {
			var stat;

			try {
				stat = fs.statSync( this.path );
			} catch ( e ) {
				if ( e.code === 'ENOENT' ) {
					logger.error( 'Path: "' + this.path + '" to "' + this.name + '" application does not exist.' );
				} else {
					logger.error( 'Error while checking path to "' + this.name + '" application:', e );
				}
				process.exit( 1 );
			}

			if ( !stat.isDirectory() ) {
				logger.error( 'Path to', '"' + this.name + '"', 'application is not a directory.' );
				process.exit( 1 );
			}
		};

		/**
		 * Build URLs to the application files that should be included in the test context
		 * @param {Array.<String>} files Paths to files to be included
		 */
		Application.prototype.buildFiles = function( files ) {
			var pattern = /\.(css|js)$/;

			this.js = [];
			this.css = [];

			if ( !Array.isArray( files ) ) {
				return;
			}

			files.forEach( function( file ) {
				var ext = pattern.exec( file );

				if ( ext ) {
					this[ ext[ 1 ] ].push(
						path.join( '/apps/', this.url, file ).split( path.sep ).join( '/' )
					);
				}
			}, this );
		};



		/**
		 * Application collection
		 * @extends {module:collection.Collection}
		 * @memberOf module:applications
		 * @constructor
		 */
		function Applications() {
			Collection.call( this );
		}

		util.inherits( Applications, Collection );

		/**
		 * Build an application collection based on the configuration object
		 * @param {Object} conf Configuration object
		 */
		Applications.prototype.build = function( conf ) {
			logger.debug( 'build', conf.applications );

			var name;

			if ( !conf.applications || typeof conf.applications != 'object' ) {
				return;
			}

			for ( name in conf.applications ) {
				this.add( name, new Application( name, conf.applications[ name ] ) );
			}
		};

		/**
		 * Applications collection
		 * @memberOf module:bender
		 * @type {module:applications.Applications}
		 * @name applications
		 */
		bender.applications = new Applications();
	},

	init: function( done ) {
		logger.debug( 'init' );

		var bender = this;

		bender.applications.build( bender.conf );
		done();
	}
};
