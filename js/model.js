// vim: set ft=javascript:

function TaskList(client, path) {
  this.client = client.scope(path);
  this.path = path;
}

(function() {
    TaskList.prototype.listTasks = function() {
      return new Promise(function(resolve, reject) {
        this.client.getListing('', false).then(function(listing) {
          var rv = [];
          var item;
          for(var name in listing) {
            if(name.endsWith('.ics')) {
              item = new TaskItem(this, name);
              rv.push(item);
            }
          }
          resolve(rv);
        }.bind(this), reject);
      }.bind(this));
    };

    TaskList.prototype.getColor = function() {
        var that = this;
        return this.client.getFile('color', false).then(function(file) {
            return (file.data || "").trim();
        }).catch(function(e) {
            console.log("Error while fetching color", that, e);
        });
    }

    TaskList.prototype.setColor = function(val) {
        var that = this;
        // FIXME: validation
        return this.client.storeFile('text/plain', 'color', val);
    }

    // These two are separate functions because one of them returns a promise
    // instead of the value.
    TaskList.prototype.getDisplayName = function(fallback) {
      var that = this;
      if(typeof(fallback) === "undefined") {
          fallback = this.path;
          // remove slash
          fallback = fallback.substring(0, fallback.length - 1);
      }

      return this.client.getFile('displayname', false).then(function(file) {
        return file.data || fallback;
      }).catch(function(e) {
        console.log("Error while fetching displaynam", that, e);
        return fallback;
      });
    };

    TaskList.prototype.setDisplayName = function(val) {
      return this.client.storeFile('text/plain', 'displayname', val);
    };

    TaskList.prototype.newTask = function() {
      var uid = generateUUID();
      var rv = new TaskItem(this, uid + '.ics');
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
})();

function TaskItem(tasklist, name) {
    this.tasklist = tasklist;
    this.name = name;
    this.jcal = null;
    this.vcalendar = null;
    this.vtodo = null;
}

(function() {
    TaskItem.prototype.ensureContent = function() {
        var that = this;
        return new Promise(function(resolve, reject) {
            that.tasklist.client.getFile(that.name, false).then(function(file) {
                if(!file.data) {
                    return reject(Error("Failed to fetch file."));
                } else {
                    that.jcal = ICAL.parse(file.data);
                    that.parseJcal();
                    return resolve(that);
                }
            }).catch(reject);
        });
    };

    TaskItem.prototype.parseJcal = function() {
        this.vcalendar = new ICAL.Component(this.jcal);
        this.vtodo = this.vcalendar.getFirstSubcomponent('vtodo');
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

    simpleProperty('summary');
    simpleProperty('description');
    simpleProperty('due');

    Object.defineProperty(TaskItem.prototype, 'percentComplete', {
        get: function() {
            return parseInt(this.vtodo.getFirstPropertyValue('percent-complete')) || 0;
        },
        set: function(val) { this.replaceField('percent-complete', val); }
    });

    Object.defineProperty(TaskItem.prototype, 'isCompleted', {
        get: function() {
            var s = this.vtodo.getFirstPropertyValue('status');
            return (s == 'CANCELLED' || s == 'COMPLETED');
        },
        set: function(val) {
            if(this.isCompleted == val) { return; }

            if(val) {
                this.percentComplete = 100;
                this.replaceField('status', 'COMPLETED');
            } else {
                this.replaceField('status', 'NEEDS-ACTION');
            }
        }
    });

    TaskItem.prototype.saveTask = function() {
      return this.tasklist.client.storeFile('text/icalendar', this.name,
                                            ICAL.stringify(this.jcal)); };
})();

RemoteStorage.defineModule('vdir_calendars', function(privateClient, publicClient) {
  privateClient.cache('');

  return {
    exports: {
      getLists: function() {
        return new Promise(function(resolve, reject) {
          privateClient.getListing('', false).then(
            function(listing) {
              var rv = [];
              for(var name in listing) {
                if(name.endsWith('/')) {
                  rv.push(new TaskList(privateClient, name));
                }
              }
              resolve(rv);
            },
            reject
          );
        });
      },
      newList: function() {
          return new TaskList(privateClient, generateUUID() + '/');
      }
    }
  };
});
