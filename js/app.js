// vim: set ft=javascript:

window.RemoteStorage.config.logging = true;
window.RemoteStorage.config.changeEvents = {
    local: true,
    window: true,
    remote: true,
    conflict: true
};

window.remoteStorage.access.claim("vdir_calendars", "rw");
window.remoteStorage.displayWidget();

(function() {
    var vdirs = window.remoteStorage.vdir_calendars;
    var React = window.React;
    var e = React.createElement;
    var utils = window.taskrs.utils;
    var moment = window.moment;
    var ICAL = window.ICAL;

    var Textarea = React.createClass({
        displayName: "Textarea",
        componentDidMount: function() {
            window.autosize(React.findDOMNode(this.refs.textarea));
        },
        render: function() {
            return e("textarea", Object.assign({}, this.props, {
                ref: "textarea"
            }));
        }
    });

    var LoadingStub = React.createClass({
        displayName: "LoadingStub",
        render: function() {
            return e("div", null, "loading...");
        }
    });

    var Welcome = React.createClass({
        displayName: "Welcome",
        render: function() {
            return e(
                "div", null,
                e(
                    "h2", null,
                    "Hello! It seems that you use Taskrs for the first time."
                ),
                e(
                    "p", null,
                    "Basically you're looking at a simple task lists ",
                    "application. If you want to use it, tap the ",
                    e("q", null, "Edit lists"),
                    " button on your left, create a new list and start adding ",
                    "tasks that come to your mind."
                ),
                e(
                    "p", null,
                    "By default your tasks are stored on the device you're ",
                    "using and are never sent to a server. ",
                    "However, if you want to keep your tasks in sync with ",
                    "another device, you can also connect this application to a ",
                    e("a", {href: "http://remotestorage.io/"}, "RemoteStorage"),
                    "-server. Depending on how ",
                    e("s", null, "paranoid "),
                    e("i", null, "security-minded"),
                    " you are, you can host your own server (see the previous ",
                    "link) or simply get an account on e.g. ", 
                    e("a", {href: "https://5apps.com/storage/beta"}, "the one from 5apps"),
                    ". Then click the icon in the top-right corner to log in ",
                    "with your RemoteStorage-account. If you then visit this ",
                    "site from another device and also log in there, your tasks ",
                    "will appear there too."
                ),
                e(
                    "p", null,
                    e(
                        "strong", null,
                        "Please note that this is still a work-in-progress. The ",
                        "app is currently very slow, and it might even loose ",
                        "your data (it's Javascript after all). Please do make ",
                        "some form of backup, or simply don't put sensitive ",
                        "data into Taskrs."
                    )
                ),
                e(
                    "p", null,
                    "If anything is unclear, ",
                    e("a", {href: "https://unterwaditzer.net/contact.html"}, "contact me!")
                )
            );
        }
    });

    var App = React.createClass({
        displayName: "App",
        getInitialState: function() {
            return {isLoading: true, isEditing: false, lists: [], shownLists: []};
        },
        loadLists: function() {
            vdirs.getLists().then(function(lists) {
                this.setState({lists: lists, isLoading: false}, this.loadShownLists);
            }.bind(this));
        },
        loadShownLists: function() {
            var that = this;
            var rv = Object.keys(this.refs).filter(function(name) {
                return name.startsWith("list_");
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
            window.remoteStorage.on("connected", this.loadLists);
            window.remoteStorage.on("not-connected", this.loadLists);
            window.remoteStorage.on("disconnected", this.loadLists);
        },
        componentWillUnmount: function() {
            window.remoteStorage.removeEventListener("connected", this.loadLists);
            window.remoteStorage.removeEventListener("not-connected", this.loadLists);
            window.remoteStorage.removeEventListener("disconnected", this.loadLists);
        },
        render: function() {
            var that = this;

            var editButton = e(
                "button",
                {
                    className: "btn btn-sm btn-default" + (that.state.isEditing ? " active" : ""),
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

            if(this.state.isLoading) {
                return e(LoadingStub);
            }

            var taskListsSidebar = e(
                "ul",
                {
                    id: "tasklists",
                    className: "nav nav-pills nav-stacked" + (this.state.isEditing ? " editing" : "")
                },
                this.state.lists.map(function(tasklist) {
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

            var taskList;
            if(this.state.lists.length == 0) {
                taskList = e(Welcome);
            } else {
                taskList = e(TaskList, {
                    ref: "tasklist",
                    shownLists: this.state.shownLists
                });
            }

            return e(
                "div", {className: "container-fluid"},
                e(
                    "div", {className: "row"},
                    e(
                        "div", {className: "col-md-4", id: "sidebar"},
                        e("h2", {className: "sr-only"}, "Task lists"),
                        e("p", null, editButton),
                        taskListsSidebar
                    ),
                    e(
                        "div", {className: "col-md-8"},
                        taskList
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
                ]).then(function() {
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

            Promise.all(lists.map(function(list) {
                return list.listTasks();
            })).then(function(listings) {
                // Flatten listings into single list of tasks
                return [].concat.apply([], listings);
            }).then(function(tasks) {
                Promise.all(tasks.map(function(task) {
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
                    tasks = utils.sortTaskList(tasks);

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
                this.teardownFunctions.map(function(func) {
                    func();
                });
            }
        },
        updateEventHandlers: function() {
            var that = this;
            this.clearEventHandlers();

            this.teardownFunctions = [];
            this.props.shownLists.map(function(list) {
                var listener = function(e) {
                    if(e.origin == "local") {
                        return;
                    }
                    console.log("List changed: ", list, e);
                    that.loadTasks(that.props.shownLists);
                };
                list.client.addEventListener("change", listener);
                that.teardownFunctions.push(function() {
                    list.client.removeEventListener("change", listener);
                });
            });
        },
        componentDidMount: function() {
            this.loadTasks(this.props.shownLists);
        },
        componentWillReceiveProps: function(nextProps) {
            if(nextProps.shownLists != this.props.shownLists) {
                console.log("TaskList: Lists updated");
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
                tasks = this.state.shownTasks.map(function(task) {
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
            // Task gets a new jcal attribute when it is refetched
            // If it's the same object, this event was probably fired by
            // selecting task lists in the sidebar.
            if(newProps.task.jcal != this._oldJcal) {
                this.setState({outdated: true});
            }
        },
        stateFromTask: function(task) {
            var due = task.due && moment(task.due.toJSDate());
            var dueDate = due && due.format("YYYY-MM-DD") || "";
            var dueTime = due && !task.due.isDate && due.format("hh:mm:ss") || "";
            this._oldJcal = task.jcal;
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
                            placeholder: "Due date, e.g. 2014-12-31",
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
                            placeholder: "Due time, e.g. 14:20",
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
                    Textarea,
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
                    className: "btn btn-block btn-primary",
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
                    e("p", null, submitButton)
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
                var editFinished = function() {
                    that.setState({isEditing: false});
                };
                inner = e("li", {className: "list-group-item"},
                          e(TaskEditor, {task: task, editFinished: editFinished}));
            } else {
                var editTask = function(e) {
                    e.preventDefault();
                    that.setState({isEditing: true});
                };
                var toggleCompleted = function() {
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

    React.render(e(App), document.getElementById("layout"));
})();
