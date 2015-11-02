// vim: set ft=javascript:
window.RemoteStorage.defineModule("vdir_calendars", function(privateClient) {
    var state = {
        listCache: {}
    };

    function TaskList(client, path) {
        this.client = client.scope(path);
        this.client.storage.caching.enable(this.client.base);
        this.path = path;
        this._itemCache = {};
    }

    TaskList.prototype.listTasks = function() {
        return new Promise(function(resolve, reject) {
            this.client.getListing("").then(function(listing) {
                var oldItemCache = this._itemCache;
                this._itemCache = {};
                var rv = [];
                var item;
                for(var name in listing) {
                    if(name.endsWith(".ics")) {
                        item = oldItemCache[name] || new TaskItem(this, name);
                        this._itemCache[name] = item;
                        rv.push(item);
                    }
                }
                resolve(rv);
            }.bind(this), reject);
        }.bind(this));
    };

    TaskList.prototype.getColor = function() {
        var that = this;
        return this.client.getFile("color").then(function(file) {
            return (file.data || "").trim();
        }).catch(function(e) {
            console.log("Error while fetching color", that, e);
        });
    };

    TaskList.prototype.setColor = function(val) {
        // FIXME: validation
        return this.client.storeFile("text/plain", "color", val || "#000000");
    };

    // These two are separate functions because one of them returns a promise
    // instead of the value.
    TaskList.prototype.getDisplayName = function(fallback) {
        var that = this;
        if(typeof(fallback) === "undefined") {
            fallback = this.path;
            // remove slash
            fallback = fallback.substring(0, fallback.length - 1);
        }

        return this.client.getFile("displayname").then(function(file) {
            return file.data || fallback;
        }).catch(function(e) {
            console.log("Error while fetching displaynam", that, e);
            return fallback;
        });
    };

    TaskList.prototype.setDisplayName = function(val) {
        return this.client.storeFile("text/plain", "displayname", val);
    };

    TaskList.prototype.newTask = function() {
        var uid = window.taskrs.utils.generateUUID();
        var rv = new TaskItem(this, uid + ".ics");
        rv.jcal = [
            "vcalendar",
            [
                ["calscale", {}, "text", "GREGORIAN"],
                ["prodid", {}, "text", "-//untitaker//taskrs//EN"],
                ["version", {}, "text", "2.0"]
            ],
            [
                ["vtodo",
                    [
                        ["uid", {}, "text", uid]
                    ],
                    []
                ]
            ]
        ];
        rv.parseJcal();
        return rv;
    };

    function TaskItem(tasklist, name) {
        this.tasklist = tasklist;
        this.name = name;
        this.jcal = null;
        this.vcalendar = null;
        this.vtodo = null;
        this._ensuredContent = false;

        console.log("new TaskItem", this);
        // FIXME: Why does remoteStorage.js call event handlers with this ==
        // window?
        this.tasklist.client.on("change", this._handleChange.bind(this));
    }

    TaskItem.prototype._handleChange = function(e) {
        if(e.origin == "local") {
            // Irrelevant event.
        } else if(e.relativePath != this.name) {
            // Not us.
        } else if(e.oldValue && !e.newValue) {
            // We got deleted, remove self.
            console.log("TaskItem: Remove event listener", this);
            this.tasklist.client.removeEventListener("change", this._handleChange);
        } else {
            console.log("TaskItem: Change detected.", this, e);
            this.jcal = null;
            this.vtodo = null;
            this.vcalendar = null;
            this._ensuredContent = false;
        }
    };

    TaskItem.prototype.ensureContent = function() {
        var that = this;
        if(this._ensuredContent) {
            return new Promise(function(a) { a(that); });
        }
        that._ensuredContent = true;

        return new Promise(function(resolve, reject) {
            that.tasklist.client.getFile(that.name).then(function(file) {
                if(!file.data) {
                    return reject(Error("Failed to fetch file."));
                } else {
                    that.jcal = window.ICAL.parse(file.data);
                    that.parseJcal();
                    return resolve(that);
                }
            }).catch(reject);
        });
    };

    TaskItem.prototype.parseJcal = function() {
        this.vcalendar = new window.ICAL.Component(this.jcal);
        this.vtodo = this.vcalendar.getFirstSubcomponent("vtodo");
    };

    TaskItem.prototype.replaceField = function(key, val) {
        this.vtodo.removeAllProperties(key);
        if(val) {
            this.vtodo.addPropertyWithValue(key, val);
        }
    };

    var simpleProperty = function(key) {
        Object.defineProperty(TaskItem.prototype, key, {
            get: function() { return this.vtodo.getFirstPropertyValue(key); },
            set: function(val) { this.replaceField(key, val); }
        });
    };

    simpleProperty("summary");
    simpleProperty("description");
    simpleProperty("due");

    Object.defineProperty(TaskItem.prototype, "percentComplete", {
        get: function() {
            return parseInt(this.vtodo.getFirstPropertyValue("percent-complete")) || 0;
        },
        set: function(val) { this.replaceField("percent-complete", val); }
    });

    Object.defineProperty(TaskItem.prototype, "isCompleted", {
        get: function() {
            var s = this.vtodo.getFirstPropertyValue("status");
            return (s == "CANCELLED" || s == "COMPLETED");
        },
        set: function(val) {
            if(this.isCompleted == val) { return; }

            if(val) {
                this.percentComplete = 100;
                this.replaceField("status", "COMPLETED");
            } else {
                this.replaceField("status", "NEEDS-ACTION");
            }
        }
    });

    TaskItem.prototype.saveTask = function() {
        return this.tasklist.client.storeFile("text/icalendar", this.name,
                                              window.ICAL.stringify(this.jcal));
    };

    return {
        exports: {
            getLists: function() {
                return new Promise(function(resolve, reject) {
                    privateClient.getListing("").then(
                        function(listing) {
                            var oldListCache = state.listCache;
                            state.listCache = {};
                            var rv = [];
                            var list;
                            for(var name in listing) {
                                if(name.endsWith("/")) {
                                    list = oldListCache[name] || new TaskList(privateClient, name);
                                    state.listCache[name] = list;
                                    delete oldListCache[name];
                                    rv.push(list);
                                }
                            }
                            for(name in oldListCache) {
                                var client = oldListCache[name].client;
                                client.storage.caching.disable(client.base);
                            }
                            resolve(rv);
                        },
                        reject
                    );
                });
            },
            newList: function() {
                return new TaskList(privateClient, window.taskrs.utils.generateUUID() + "/");
            }
        }
    };
});
