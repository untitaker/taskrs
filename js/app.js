// vim: set ft=javascript:

/* global require */

require("remotestoragejs/release/stable/remotestorage.amd.js");

window.remoteStorage = new window.RemoteStorage({
    logging: true,
    changeEvents: {
        local: true,
        window: true,
        remote: true,
        conflict: true
    },
    remote: { online: false }
});

window.RemoteStorage.defineModule("vdir_calendars", require("./model.js"));

var React = require("react");
var ReactDOM = require("react-dom");
var e = React.createElement;
var utils = require("./utils.js");
var moment = require("moment");
var ICAL = require("ical.js");
var marked = require("marked");
var Autolinker = require("autolinker");
var autosize = require("autosize");

window.remoteStorage.access.claim("vdir_calendars", "rw");
window.remoteStorage.displayWidget();

window.remoteStorage.on("ready", function() {
    var vdirs = window.remoteStorage.vdir_calendars;

    class Textarea extends React.Component {
        constructor(props) {
            super(props);
        }
        render() {
            return e("textarea", Object.assign({}, this.props, {
                ref: function(elem) {
                    if(elem !== null) {
                        var elem2 = ReactDOM.findDOMNode(elem);
                        autosize(elem2);
                        autosize.update(elem2);
                    }
                }
            }));
        }
    }

    class LoadingStub extends React.Component {
        render() {
            return e("div", null, "loading...");
        }
    }

    class Welcome extends React.Component {
        render() {
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
    }

    class App extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                isLoading: true, isEditing: false, lists: [],
                shownLists: [], showCompletedTasks: false
            };
        }
        loadLists() {
            vdirs.getLists().then(function(lists) {
                this.setState({lists: lists, isLoading: false}, this.loadShownLists);
            }.bind(this));
        }
        loadShownLists() {
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
        }
        componentDidMount() {
            window.remoteStorage.on("connected", this.loadLists);
            window.remoteStorage.on("not-connected", this.loadLists);
            window.remoteStorage.on("disconnected", this.loadLists);
        }
        componentWillUnmount() {
            window.remoteStorage.removeEventListener("connected", this.loadLists);
            window.remoteStorage.removeEventListener("not-connected", this.loadLists);
            window.remoteStorage.removeEventListener("disconnected", this.loadLists);
        }
        render() {
            var that = this;

            var editButton = e("small", null, e(
                "a",
                {
                    href: "#",
                    className: (that.state.isEditing ? " active" : ""),
                    onClick: function(e) {
                        e.preventDefault();
                        that.setState({isEditing: !that.state.isEditing});
                    }
                },
                (that.state.isEditing ? (
                    e("span", {className: "glyphicon glyphicon-ok"}),
                    " Done"
                ) : (
                    e("span", {className: "glyphicon glyphicon-pencil"}),
                    " Edit lists"
                ))
            ));

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
            if(this.state.lists.length === 0) {
                taskList = e(Welcome);
            } else {
                taskList = e(TaskList, {
                    ref: "tasklist",
                    shownLists: this.state.shownLists,
                    showCompletedTasks: this.state.showCompletedTasks
                });
            }

            var toggleCompletedTasksButton = e(
                "small", null,
                e(
                    "label", null,
                    e(
                        "input",
                        {
                            type: "checkbox",
                            checked: this.state.showCompletedTasks,
                            onChange: function() {
                                that.setState({
                                    showCompletedTasks: !that.state.showCompletedTasks
                                });
                            }
                        }
                    ),
                    " Show completed tasks"
                )
            );

            return e(
                "div", {className: "container-fluid"},
                e(
                    "div", {className: "row"},
                    e(
                        "div", {className: "col-md-4", id: "sidebar"},
                        e("h2", {className: "sr-only"}, "Task lists"),
                        e("p", null, editButton),
                        taskListsSidebar,
                        e("p", null, toggleCompletedTasksButton)
                    ),
                    e(
                        "div", {className: "col-md-8"},
                        taskList
                    )
                )
            );
        }
    }

    class TaskListSelectorItem extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                displayName: "",
                color: null,
                isActive: true,
                mode: "normal"
            };
        }
        getDefaultProps() {
            return {showEditFunctions: false};
        }
        componentWillReceiveProps(newProps) {
            this.setEditFunctions(newProps);
        }
        componentWillMount() {
            this.refreshData();
            this.setEditFunctions(this.props);
        }
        setEditFunctions(newProps) {
            if(newProps.showEditFunctions) {
                this.setState({mode: "showEditFunctions"});
            } else {
                this.setState({mode: "normal"});
            }
        }
        getStyle() {
            return {borderLeft: "3px solid " + this.state.color};
        }

        static modes = {
            editName: function() {
                return e(TaskListEditor, {
                    list: this.props.tasklist,
                    editFinished: function(changed) {
                        this.setState({mode: "showEditFunctions"});
                        if(changed) {
                            this.refreshData();
                        }
                    }.bind(this),
                    style: this.getStyle()
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
                        style: this.getStyle()
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
                        style: this.getStyle()
                    },
                    this.state.displayName
                );
            }
        }
        refreshData() {
            var that = this;
            this.props.tasklist.getDisplayName().then(function(name) {
                that.setState({displayName: name});
            });
            this.props.tasklist.getColor().then(function(color) {
                that.setState({color: color});
            });
        }
        isActive() {
            return this.state.isActive;
        }
        render() {
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
    }

    class TaskListAdder extends React.Component {
        constructor(props) {
            super(props);
            this.state = {isAdding: false};
        }
        render() {
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
    }

    class TaskListEditor extends React.Component {
        constructor(props) {
            super(props);
            this.state = {displayName: "", color: ""};
        }
        componentWillMount() {
            var that = this;
            this.props.list.getDisplayName("").then(function(name) {
                that.setState({displayName: name});
            });
            this.props.list.getColor().then(function(color) {
                that.setState({color: color});
            });
        }
        componentDidMount() {
            // Focus only once.
            ReactDOM.findDOMNode(this.refs.displayname).focus();
        }
        render() {
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
    }

    class TaskList extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                shownTasks: [],
                showTaskAdder: false
            };
        }
        loadTasks(lists, showCompletedTasks) {
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

                        if(!showCompletedTasks && task.isCompleted) {
                            console.log("Completed", task);
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
        }
        clearEventHandlers() {
            if(this.teardownFunctions) {
                this.teardownFunctions.map(function(func) {
                    func();
                });
            }
        }
        updateEventHandlers() {
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
        }
        componentDidMount() {
            this.loadTasks(this.props.shownLists,
                           this.props.showCompletedTasks);
        }
        componentWillReceiveProps(nextProps) {
            if(
              nextProps.shownLists != this.props.shownLists ||
              nextProps.showCompletedTasks != this.props.showCompletedTasks
            ) {
                console.log("TaskList: Lists updated");
                this.loadTasks(nextProps.shownLists,
                               nextProps.showCompletedTasks);
            }
        }
        render() {
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
    }

    class TaskAdder extends React.Component {
        constructor(props) {
            super(props);
            this.state = {isAdding: null, labelHint: "New Task"};
            this.props.tasklist.getDisplayName().then(function(name) {
                this.setState({labelHint: "New Task in " + name});
            }.bind(this));
        }
        startAdd() {
            this.setState({isAdding: this.props.tasklist.newTask()});
        }
        stopAdd() {
            this.setState({isAdding: null});
        }
        render() {
            var inner;
            if(this.state.isAdding !== null) {
                var newTask = this.state.isAdding;
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
    }

    class TaskEditor extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                summary: "",
                description: "",
                dueDate: "",
                dueTime: "",
                outdated: false
            };
        }
        componentDidMount() {
            this.stateFromTask(this.props.task);
            ReactDOM.findDOMNode(this.refs.summary).focus();
        }
        componentWillReceiveProps(newProps) {
            // Task gets a new jcal attribute when it is refetched
            // If it's the same object, this event was probably fired by
            // selecting task lists in the sidebar.
            if(newProps.task.jcal != this._oldJcal) {
                this.setState({outdated: true});
            }
        }
        stateFromTask(task) {
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
        }
        stateToTask(task) {
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
        }
        render() {
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
                            pattern: ".{1,}",
                            required: true,
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
    }

    class TaskDueLabel extends React.Component {
        componentDidMount() {
            this.updateInterval = window.setInterval(
                this.forceUpdate,
                1800 * 1000
            );
        }
        componentWillUnmount() {
            window.clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }
        render() {
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
    }

    class Task extends React.Component {
        constructor(props) {
            super(props);
            this.state = {tasklistColor: null, mode: "collapsed"};
        }
        componentWillMount() {
            var that = this;
            this.props.task.tasklist.getColor().then(function(color) {
                that.setState({tasklistColor: color});
            });
        }
        setMode(x) {
            this.setState({mode: x});
        }
        static modes = {
            editing: function() {
                var task = this.props.task;

                return e(TaskEditor, {
                    task: task,
                    editFinished: this.setMode.bind(this, "expanded")
                });
            },
            collapsed: function() {
                var task = this.props.task;

                return e(TaskSingleLineRepr, {
                    task: task,
                    toggleDetails: this.setMode.bind(this, "expanded")
                });
            },
            expanded: function() {
                var task = this.props.task;
                var that = this;

                var markdownDescription = "";
                if(task.description) {
                    markdownDescription = Autolinker.link(marked(task.description));
                }

                return e(
                    "div", {className: "panel panel-default"},
                    e(
                        "div", {className: "panel-heading"},
                        e(
                            "button", {
                                className: "task-edit-button pull-right",
                                onClick: function(e) {
                                    e.preventDefault();
                                    that.setMode("editing");
                                }
                            },
                            "Edit"
                        ),
                        e(TaskSingleLineRepr, {
                            task: task,
                            className: "panel-title clearfix",
                            toggleDetails: this.setMode.bind(this, "collapsed")
                        })
                    ),
                    e(
                        "div", {className: "panel-body"},
                        e("div", {
                            className: "task-description",
                            dangerouslySetInnerHTML: {
                                __html: markdownDescription
                            }
                        })
                    )
                );
            }
        }
        render() {
            var task = this.props.task;
            var inner = this.modes[this.state.mode].bind(this)();
            var className = (
                "task mode-" + this.state.mode + (task.isCompleted ? " done" : "")
            );

            var style = null;
            if(this.state.mode == "collapsed") {
                style = {borderLeft: "3px solid " + this.state.tasklistColor};
            }

            return e(
                "li",
                {className: className, style: style},
                inner
            );
        }
    }

    class TaskSingleLineRepr extends React.Component {
        render() {
            var task = this.props.task;
            var that = this;
            var toggleCompleted = function() {
                task.isCompleted = !task.isCompleted;
                task.saveTask();
                that.forceUpdate();
            };
            return e(
                "div", {"className": this.props.className},
                e(
                    "div", {className: "task-checkbox"},
                    e(
                        "input",
                        {
                            type: "checkbox",
                            checked: task.isCompleted,
                            onChange: toggleCompleted
                        }
                    )
                ),
                e(
                    "a",
                    {
                        href: "#",
                        onClick: function(e) {
                            e.preventDefault();
                            that.props.toggleDetails();
                        },
                        className: "task-summary"
                    },
                    task.summary,
                    " ",
                    e(TaskDueLabel, {task: task})
                )
            );
        }
    }

    ReactDOM.render(e(App), document.getElementById("layout"));
});
