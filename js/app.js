// vim: set ft=javascript:

RemoteStorage.config.logging = true;
RemoteStorage.config.changeEvents = {
  local: true,
  window: true,
  remote: true,
  conflict: true
};

remoteStorage.access.claim('vdir_calendars', 'rw');
remoteStorage.displayWidget();

(function() {
    var vdirs = remoteStorage.vdir_calendars;
    var e = React.createElement;
  
    var App = React.createClass({
      displayName: "App",
      getInitialState: function() {
        return {isLoading: true, isEditing: false, lists: [], shownLists: []};
      },
      loadLists: function() {
        vdirs.getLists().then(function(lists) {
          this.setState({lists: lists, isLoading: false});
          this.loadShownLists();
        }.bind(this));
      },
      loadShownLists: function() {
        var that = this;
        var rv = Object.keys(this.refs).filter(function(name) {
            return name.startsWith('list_');
        }).map(function(name) {
            return that.refs[name];
        }).filter(function(element) {
            return element.isActive();
        }).map(function(element) {
            return element.props.tasklist;
        });
        console.log("shownLists", rv);
        this.setState({shownLists: rv});
        return rv;
      },
      componentDidMount: function() {
        this.loadLists();
        remoteStorage.on('connected', this.loadLists);
        remoteStorage.on('disconnected', this.loadLists);
      },
      componentWillUnmount: function() {
        remoteStorage.removeEventListener('connected', this.loadLists);
        remoteStorage.removeEventListener('disconnected', this.loadLists);
      },
      render: function() {
        var that = this;

        var editButton = e(
            "button",
            {
                className: "btn btn-sm btn-default",
                onClick: function(e) {
                    e.preventDefault();
                    that.setState({isEditing: !that.state.isEditing});
                }
            },
            (that.state.isEditing ? [
                e("span", {className: "glyphicon glyphicon-ok"}),
                " Done"
            ] : [
                e("span", {className: "glyphicon glyphicon-pencil"}),
                " Edit lists"
            ])
        );

        var taskLists;
        if(this.state.isLoading) {
          taskLists = e("div", null, "loading...");
        } else {
          taskLists = e(
              "ul",
              {
                  id: "tasklists",
                  className: "nav nav-pills nav-stacked"
              },
              this.state.lists.map(function(tasklist, index) {
                  return e(TaskListSelectorItem, {
                      ref: "list_" + tasklist.path,
                      onToggle: this.loadShownLists,
                      tasklist: tasklist,
                      showEditFunctions: this.state.isEditing,
                      key: tasklist.path
                  });
              }.bind(this)),
              (
                  this.state.isEditing ?
                      e("li", null, e(TaskListAdder, {listAdded: this.loadLists})) :
                      null
              )
          );
        }

        
        return e(
            "div", {className: "container-fluid"},
            e(
                "div", {className: "row"},
                e(
                    "div", {className: "col-md-4", id: "sidebar"},
                    e("h2", {className: "sr-only"}, "Task lists"),
                    e("p", null, editButton),
                    taskLists
                ),
                e(
                    "div", {className: "col-md-8"},
                    e(TaskList, {
                        ref: "tasklist",
                        shownLists: this.state.shownLists
                    })
                )
            )
        );
      }
    });

    var TaskListSelectorItem = React.createClass({
      displayName: "TaskListSelectorItem",
      getInitialState: function() {
          return {displayName: "", color: null, isActive: true, mode: "normal"};
      },
      getDefaultProps: function() {
          return {showEditFunctions: false};
      },
      componentWillReceiveProps: function(newProps) {
           this.setEditFunctions(newProps);
      },
      componentWillMount: function() {
          this.refreshData();
          this.setEditFunctions(this.props);
      },
      setEditFunctions: function(newProps) {
          if(newProps.showEditFunctions) {
              this.setState({mode: "showEditFunctions"});
          } else {
              this.setState({mode: "normal"});
          }
      },
      modes: {
          editName: function() {
              return e(TaskListEditor, {
                  list: this.props.tasklist,
                  editFinished: function(changed) {
                      this.setState({mode: "showEditFunctions"});
                      if(changed) {
                          this.refreshData();
                      }
                  }.bind(this),
                  style: {borderLeftColor: this.state.color}
              });
          },
          showEditFunctions: function() {
              return e(
                  "a",
                  {
                      "href": "#",
                      onClick: function(e) {
                          e.preventDefault();
                          this.setState({mode: "editName"});
                      }.bind(this),
                      style: {borderLeftColor: this.state.color}
                  },
                  e("span", {className: "glyphicon glyphicon-pencil"}),
                  " ",
                  this.state.displayName
              );
          },
          normal: function() {
              return e(
                  "a", {
                      href: "#",
                      onClick: function(e) {
                          e.preventDefault();
                          this.setState({isActive: !this.isActive()}, this.props.onToggle);
                      }.bind(this),
                      style: {borderLeftColor: this.state.color}
                  },
                  this.state.displayName
              );
          }
      },
      refreshData: function() {
          var that = this;
          this.props.tasklist.getDisplayName().then(function(name) {
              that.setState({displayName: name});
          });
          this.props.tasklist.getColor().then(function(color) {
              that.setState({color: color});
          });
      },
      isActive: function() {
        return this.state.isActive;
      },
      render: function() {
          var that = this;
          var content = this.modes[this.state.mode].bind(this);
          return e(
              "li",
              {
                  className: (
                      this.isActive() && this.state.mode == "normal" ?
                          "active" :
                          ""
                  )
              },
              content()
          );
      }
    });

    var TaskListAdder = React.createClass({
        getInitialState: function() {
            return {isAdding: false};
        },
        render: function() {
            var that = this;
            if(this.state.isAdding) {
                return e(TaskListEditor, {
                    list: vdirs.newList(),
                    editFinished: function(changed) {
                        that.setState({isAdding: false});
                        if(changed) {
                            that.props.listAdded();
                        }
                    }
                });
            } else {
                return e(
                    "a",
                    {
                        href: "#",
                        onClick: function(e) {
                            e.preventDefault();
                            that.setState({isAdding: true});
                        }
                    },
                    e("span", {className: "glyphicon glyphicon-plus"}),
                    " Create list"
                );
            }
        }
    });

    var TaskListEditor = React.createClass({
        displayName: "TaskListEditor",
        getInitialState: function() {
            return {displayName: "", color: ""};
        },
        componentWillMount: function() {
            var that = this;
            this.props.list.getDisplayName("").then(function(name) {
                that.setState({displayName: name});
            });
            this.props.list.getColor().then(function(color) {
                that.setState({color: color});
            });
        },
        componentDidMount: function() {
            // Focus only once.
            React.findDOMNode(this.refs.displayname).focus();
        },
        render: function() {
            var that = this;
            var list = this.props.list;
            console.log("TaskListEditor on", list);

            var submitEdit = function(e) {
                e.preventDefault();
                Promise.all([
                    list.setDisplayName(that.state.displayName),
                    list.setColor(that.state.color)
                ]).then(function(_) {
                    that.props.editFinished(true);
                });
            };

            var abortEdit = function(e) {
                e.preventDefault();
                that.props.editFinished(false);
            };

            return e(
                "form", {onSubmit: submitEdit},
                e(
                    "div", {className: "form-group"},
                    e(
                        "div", {className: "input-group"},
                        e(
                            "span", {className: "input-group-btn"},
                            e(
                                "button",
                                {
                                    type: "button",
                                    className: "btn btn-default",
                                    title: "Discard changes",
                                    onClick: abortEdit
                                },
                                e("span", {className: "glyphicon glyphicon-arrow-left"}),
                                e("span", {className: "sr-only"}, "Discard changes")
                            )
                        ),
                        e(
                            "input",
                            {
                                type: "text",
                                name: "displayname",
                                className: "form-control",
                                placeholder: "List name",
                                ref: "displayname",
                                value: that.state.displayName,
                                onChange: function(e) {
                                    that.setState({displayName: e.target.value});
                                }
                            }
                        ),
                        e(
                            "span", {className: "input-group-btn"},
                            e("input", {className: "btn btn-primary", type: "submit", value: "Save"})
                        )
                    )
                ),
                e(
                    "div", {className: "form-group"},
                    e(
                        "input",
                        {
                            type: "color",
                            name: "color",
                            className: "form-control",
                            value: that.state.color,
                            onChange: function(e) {
                                that.setState({color: e.target.value});
                            }
                        }
                    )
                )
            );
        }
    });

    var TaskList = React.createClass({
      displayName: "TaskList",
      getInitialState: function() {
        return {
            shownTasks: [],
            showTaskAdder: false
        };
      },
      loadTasks: function(lists) {
        var that = this;
        console.log("Lists: ", lists.map(function(list) {return list.path;}));

        Promise.all(lists.map(function(list, i) {
          return list.listTasks();
        })).then(function(listings) {
          // Flatten listings into single list of tasks
          return [].concat.apply([], listings);
        }).then(function(tasks) {
          Promise.all(tasks.map(function(task, i) {
            return task.ensureContent().catch(function(e) {
                console.log("Skipping task", task, e);
                return undefined;
            });
          })).then(function(tasks) {
            tasks = tasks.filter(function(task) {
                if(typeof(task) === "undefined") {
                    return false;
                }
                if(task.jcal && task.vcalendar && !task.vtodo) {
                    // not a vtodo item, otherwise probably fine
                    return false;
                }
                return true;
            });
            tasks = sortTaskList(tasks);

            console.log("Tasks: ", tasks);
            that.setState({
                shownTasks: tasks,
                showTaskAdder: lists.length == 1
            });
            that.updateEventHandlers();
          });
        });
      },
      clearEventHandlers: function() {
          if(this.teardownFunctions) {
              this.teardownFunctions.map(function(func, i) {
                  func();
              });
          }
      },
      updateEventHandlers: function() {
        var that = this;
        this.clearEventHandlers();
        
        this.teardownFunctions = [];
        this.props.shownLists.map(function(list, i) {
          var listener = function(e) {
              if(e.origin == 'local') {
                  return;
              }
              console.log("List changed: ", list, e);
              that.loadTasks(that.props.shownLists);
          };
          list.client.addEventListener('change', listener);
          that.teardownFunctions.push(function() {
            list.client.removeEventListener('change', listener);
          });
        });
      },
      componentDidMount: function() {
          this.loadTasks(this.props.shownLists);
      },
      componentWillReceiveProps: function(nextProps) {
          if(nextProps.shownLists != this.props.shownLists) {
              this.loadTasks(nextProps.shownLists);
          }
      },
      render: function() {
        var taskadder;
        if(this.state.showTaskAdder) {
          taskadder = e(TaskAdder, {tasklist: this.props.shownLists[0]});
        } else {
          taskadder = e(
              "li", {className: "list-group-item disabled"},
              e(
                  "input",
                  {
                      type: "text",
                      className: "form-control",
                      disabled: true,
                      placeholder: "Select exactly one list to add tasks."
                  }
              )
          );
        }
        var tasks;
        if(this.state.shownTasks.length) {
            tasks = this.state.shownTasks.map(function(task, i) {
                return e(Task, {
                    task: task,
                    key: task.tasklist.path + task.name
                });
            });
        } else {
            tasks = e("li", {className: "list-group-item disabled"},
                      "No tasks.");
        }

        var list = e(
            "ul", {id: "tasklist", className: "list-group"},
            taskadder,
            tasks
        );

        return e(
            "div", null,
            e("h2", {className: "sr-only"}, "Tasks"),
            list
        );
      }
    });

    var TaskAdder = React.createClass({
      displayName: "TaskAdder",
      getInitialState: function() {
        this.props.tasklist.getDisplayName().then(function(name) {
          this.setState({labelHint: "New Task in " + name});
        }.bind(this));

        return {isAdding: false, labelHint: "New Task"};
      },
      startAdd: function() {
        this.setState({isAdding: true});
      },
      stopAdd: function() {
        this.setState({isAdding: false});
      },
      render: function() {
        var that = this;
        var inner;
        if(this.state.isAdding) {
          var newTask = this.props.tasklist.newTask();
          inner = e(TaskEditor, {task: newTask, editFinished: this.stopAdd});
        } else {
          inner = e(
              "input",
              {
                  type: "text",
                  className: "form-control",
                  placeholder: this.state.labelHint,
                  onClick: this.startAdd
              }
          );
        }
        return e("li", {className: "list-group-item"}, inner);
      }
    });

    var TaskEditor = React.createClass({
      displayName: "TaskEditor",
      getInitialState: function() {
        return {summary: "", description: "", dueDate: "", dueTime: "", outdated: false};
      },
      componentDidMount: function() {
          this.stateFromTask(this.props.task);
          React.findDOMNode(this.refs.summary).focus();
      },
      componentWillReceiveProps: function(newProps) {
          this.setState({outdated: true});
      },
      stateFromTask: function(task) {
        var due = task.due && moment(task.due.toJSDate());
        var dueDate = due && due.format("YYYY-MM-DD") || "";
        var dueTime = !task.due.isDate && due.format("hh:mm:ss") || "";
        this.setState({
            summary: task.summary || "",
            description: task.description || "",
            dueDate: dueDate,
            dueTime: dueTime
        });
      },
      stateToTask: function(task) {
        task.summary = this.state.summary;
        task.description = this.state.description;

        if(this.state.dueDate) {
            var stringVal = this.state.dueDate;
            if(this.state.dueTime) {
                stringVal += "T" + this.state.dueTime;
            }

            // Date-time inputs are inconsistent across browsers:
            //   * 21:00 vs 21:00:00
            // Moment.js tries several formats automatically.
            var momentVal = moment(stringVal);
            var icalVal = ICAL.Time.fromJSDate(momentVal.toDate(), false);
            icalVal.isDate = !this.state.dueTime;
            console.log("IsDate", icalVal.isDate);

            console.log(stringVal, "string");
            console.log(momentVal, "moment");
            console.log(icalVal, "ical");
            task.due = icalVal;

        } else {
            task.due = null;
        }
      },
      render: function() {
        var that = this;
        var task = this.props.task;
        console.log("TaskEditor on", task);

        var submitEdit = function(e) {
          e.preventDefault();
          that.stateToTask(task);
          task.saveTask();
          that.props.editFinished(true);
        };
        var abortEdit = function(e) {
          e.preventDefault();
          that.props.editFinished(false);
        };

        var header = e(
            "div", {className: "form-group"},
            e(
                "div", {className: "input-group"},
                e(
                    "span", {className: "input-group-btn"},
                    e(
                        "button",
                        {
                            type: "button",
                            className: "btn btn-default",
                            title: "Discard changes",
                            onClick: abortEdit
                        },
                        e("span", {className: "glyphicon glyphicon-arrow-left"}),
                        e("span", {className: "sr-only"}, "Discard changes")
                    )
                ),
                e(
                    "input",
                    {
                        type: "text",
                        name: "summary",
                        className: "form-control",
                        placeholder: "Summary",
                        ref: "summary",
                        value: this.state.summary,
                        onChange: function(e) { that.setState({summary: e.target.value}); }
                    }
                )
            )
        );

        var dueDateChanges = function(e) {
            var val = e.target.value;
            that.setState({
                dueDate: val,
                dueTime: val && that.state.dueTime || ""
            });
        };

        var dueTimeChanges = function(e) {
            that.setState({dueTime: e.target.value});
        };

        var dueInput = e(
            "div", {className: "form-group row"},
            e(
                "div", {className: "col-xs-6", style: {paddingRight: 0}},
                e(
                    "input",
                    {
                        type: "date",
                        name: "dueDate",
                        className: "form-control",
                        placeholder: "Due date",
                        value: this.state.dueDate,
                        onChange: dueDateChanges,
                        onBlur: dueDateChanges  // https://github.com/facebook/react/issues/3659
                    }
                )
            ),
            e(
                "div", {className: "col-xs-6"},
                e(
                    "input",
                    {
                        type: "time",
                        name: "dueTime",
                        className: "form-control",
                        placeholder: "Due time",
                        value: this.state.dueTime,
                        onChange: dueTimeChanges,
                        onBlur: dueTimeChanges  // https://github.com/facebook/react/issues/3659
                    }
                )
            )
        );

        var descriptionInput = e(
            "div", {className: "form-group"},
            e(
                "textarea",
                {
                    className: "form-control",
                    name: "description",
                    placeholder: "Description: Further notes",
                    value: this.state.description,
                    onChange: function(e) { that.setState({description: e.target.value}); }
                }
            )
        );

        var submitButton = e(
            "input",
            {
                type: "submit",
                className: (
                    "btn btn-block btn-" +
                    (this.state.outdated ? "danger" : "primary")
                ),
                value: (this.state.outdated ? "Save anyway" : "Save")
            }
        );

        if(this.state.outdated) {
            submitButton = e(
                "div",
                {className: "alert alert-danger"},
                e(
                    "p", null,
                    "This task has changed while you were editing it. ",
                    "Saving your changes will discard those changes."
                ),
                submitButton
            );
        }

        return e(
            "form", {onSubmit: submitEdit},
            header,
            dueInput,
            descriptionInput,
            submitButton
        );
      }
    });

    var TaskDueLabel = React.createClass({
        displayName: "TaskDueLabel",
        componentDidMount: function() {
            this.updateInterval = window.setInterval(
                this.forceUpdate,
                1800 * 1000
            );
        },
        componentWillUnmount: function() {
            window.clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        },
        render: function() {
            var task = this.props.task;
            if(!task.due) {
                return null;
            }
            var dueMoment = moment(
                task.due.convertToZone(
                    ICAL.Timezone.localTimezone
                ).toJSDate()
            );

            var labelColor = "default";
            if(!task.isCompleted && dueMoment.isBefore(moment())) {
                labelColor = "danger";
            }
            var dueLabel = e(
                "span",
                {className: "label label-" + labelColor},
                dueMoment.fromNow()
            );
            return dueLabel;
        }
    });

    var Task = React.createClass({
      displayName: "Task",
      getInitialState: function() {
        return {isEditing: false, tasklistColor: null};
      },
      componentWillMount: function() {
        var that = this;
        this.props.task.tasklist.getColor().then(function(color) {
            that.setState({tasklistColor: color});
        });
      },
      render: function() {
        var inner;
        var that = this;
        var task = this.props.task;

        if(this.state.isEditing) {
          var editFinished = function(changed) {
            that.setState({isEditing: false});
          };
          inner = e("li", {className: "list-group-item"},
                    e(TaskEditor, {task: task, editFinished: editFinished}));
        } else {
          var editTask = function(e) {
            e.preventDefault();
            that.setState({isEditing: true});
          };
          var toggleCompleted = function(e) {
            task.isCompleted = !task.isCompleted;
            task.saveTask();
            that.forceUpdate();
          };
          var className = (
            "task list-group-item" + (task.isCompleted ? " disabled" : "")
          );

          inner = e(
              "li", {
                  className: className,
                  style: {borderLeftColor: this.state.tasklistColor}
              },
              e(
                  "input",
                  {
                      type: "checkbox",
                      checked: task.isCompleted,
                      onChange: toggleCompleted
                  }
              ),
              " ",
              e(
                  "a",
                  {
                      href: "#",
                      onClick: editTask,
                      title: "Edit task"
                  },
                  task.summary
              ),
              " ",
              e(TaskDueLabel, {task: task})
          );
        }
        return inner;
      }
    });

    React.render(e(App), document.getElementById('layout'));
})();
