// vim: set ft=javascript:

module.exports = {
    generateUUID: function(){
        var d = new Date().getTime();
        var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c == "x" ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
    },
    compareArraysPerItem: function(a, b) {
        // Simulate sort order of Python's tuples
        var elA, elB, i, len; 
        for (i = 0, len = Math.min(a.length, b.length); i < len; i++) {
            elA = a[i];
            elB = b[i];
            if (elA > elB) return 1;
            if (elA < elB) return -1;
        }
        return b.length - a.length;
    },
    sortTaskList: function(tasks) {
        var that = this;
        var key = function(x) {
            return [x.isCompleted, x.due === null ? 1/0 : x.due.toUnixTime()];
        };
        return tasks.sort(function(a, b) {
            return that.compareArraysPerItem(key(a), key(b));
        });
    },
    slugify: function(text) {
        return text
            .toLowerCase()
            .replace(/ /g, "-")
            .replace(/[^\w-]+/g, "");
    }
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(searchString, position) {
        var subjectString = this.toString();
        if (position === undefined || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    };
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
        position = position || 0;
        return this.indexOf(searchString, position) === position;
    };
}
