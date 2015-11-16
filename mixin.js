// @author: Joshua Tanner
// mixin.js
// mixin supplied object params with an
// exisiting object

var mixin = function (newObj, oldObj) {
	if(typeof newObj !== 'object') {
		throw 'Please provide an object';
	}
	var result = oldObj || {}; // can be empty obj
	for ( var key in newObj ) {
		if( newObj.hasOwnProperty(key) ) {
			result[key] = newObj[key];
		}
	}
	return result;
};

module.exports = mixin;

