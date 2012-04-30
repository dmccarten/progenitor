/*
 * progenitor
 * https://github.com/jhugman/progenitor
 *
 * Copyright (c) 2012 jhugman
 * Licensed under the Apache license.
 */
"use strict";
var fs = require("fs"),
    _ = require("underscore");

exports.createProjectFromObject = function (templateDir, targetDir, options) {
	exports.createProject(templateDir, targetDir, function (key) {
		return options[key];
	});
};

var opener = "__";
var closer = "__";
var keyname = "[A-Za-z]([\\w]*[A-Za-z0-9])?";
var reDetector = new RegExp(opener + keyname + closer, "g");
var reKeyFinder = new RegExp("^" + opener + "(" + keyname + ")" + closer + "$");

var doReplacement = true;
var keysFound = [];

exports.createOptionSelector = function (options) {
	options = options || {};
	return function (key) {
		return options[key] || process.env[key] || null;
	};
};


function textReplace(text, optionSelector) {
	optionSelector = optionSelector || function (k) { return null; };
	return text.replace(reDetector, function (variable) {
		var match = variable.match(reKeyFinder);
		var initialValue = optionSelector(match[1]);
		var retValue;
		if (initialValue) {
			retValue = textReplace(initialValue, optionSelector);
		} else {
			retValue = variable;
		}
		keysFound.push(match[1]);
		return retValue;
	});	
}
exports.textReplace = textReplace;

function textReplaceFile(src, dest, optionSelector) {
	var text = fs.readFileSync(src).toString();
	var newText = textReplace(text, optionSelector);
	if (doReplacement) {
	    fs.writeFileSync(dest, newText);
	}
}

function textReplaceFilename(src, optionSelector) {
	return textReplace(src, optionSelector);
}



function textReplaceDirName(src, optionSelector) {
	var replaceDots = false;
	var newOptionSelector = function (key) {
		if (key.indexOf("JAVA_PACKAGE") >= 0) {
			replaceDots = true;
		}
		return optionSelector(key);
	};
	var value = textReplace(src, newOptionSelector);
	if (replaceDots) {
		value = value.replace(/\./g, "/");
	}
	return value;
}

var path = require("path");
function mkdirs (dirname) {
	if (path.existsSync(dirname)) {
		return true;
	} else {
		mkdirs(path.dirname(dirname));
		fs.mkdirSync(dirname, "0755");
	}
}
exports.mkdirs = mkdirs;

exports.textReplaceFileTree = function textReplaceFileTree (src, destDir, optionSelector, suppressTopLevelDir) {
	var filename, dest;
	var info = fs.statSync(src);
    if (info.isDirectory()) {
    	filename = textReplaceDirName(path.basename(src), optionSelector);
    	if (!suppressTopLevelDir) {    	    
    	    dest = path.join(destDir, filename);
    	} else {
    	    dest = destDir;
    	}
    	if (doReplacement) {
    	    mkdirs(dest);
    	}
    	var files = fs.readdirSync(src);
    	var max=files.length;
    	for (var i=0; i<max; i++) {
    		textReplaceFileTree(path.join(src, files[i]), dest, optionSelector);
    	}
    	
    } else {
    	filename = textReplaceFilename(path.basename(src), optionSelector);
    	dest = path.join(destDir, filename);
    	textReplaceFile(src, dest, optionSelector);
    }
};

exports.collectKeys = function (src, options) {
    doReplacement = false;
    keysFound = [];
    var selector = exports.createOptionSelector(options || {});
    
    exports.textReplaceFileTree(src, null, selector);
    
    doReplacement = true;
    var unique = _.unique(keysFound);
    keysFound = [];
    return unique;
};