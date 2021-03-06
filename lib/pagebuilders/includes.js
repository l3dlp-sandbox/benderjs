/**
 * Copyright (c) 2014-2015, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 *
 * @file Page builder responsible for including scripts defined with bender-includes directive(s)
 */

'use strict';

/**
 * @module pagebuilders/includes
 */
module.exports = {
	name: 'bender-pagebuilder-includes',

	/**
	 * Include files added with include directives in a test page
	 * @param  {Object} data Test page data
	 * @return {Object}
	 */
	build: function( data ) {
		var bender = this;

		if ( !Array.isArray( data.include ) || !data.include.length ) {
			return data;
		}

		// inject the included scripts to the test page parts
		data.include.forEach( function( script ) {
			data.addJS( bender.template.replaceTags( script, data ) );
		} );

		return data;
	}
};
