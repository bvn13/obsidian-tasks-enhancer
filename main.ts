import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { Moment } from "moment";

interface TasksPluginEnhencerSettings {
	isNeedToAddCreatedAtDateOnToday: boolean;
	isNeedToAddScheduledDateOnToday: boolean;
}

const TASKS_PLUGIN_ENHANCER_DEFAULT_SETTINGS: TasksPluginEnhencerSettings = {
	isNeedToAddCreatedAtDateOnToday: true,
	isNeedToAddScheduledDateOnToday: true
}

export default class TasksPluginEnhancer extends Plugin {
	settings: TasksPluginEnhencerSettings;

	async onload() {
		await this.loadSettings();

		// // This creates an icon in the left ribbon.
		// const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (_evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('This is a notice!');
		// });
		// // Perform additional things with the ribbon
		// ribbonIconEl.addClass('my-plugin-ribbon-class');

		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'tasks-enhancer-new-task',
			name: 'New Task',
			editorCallback: (editor: Editor) => {
				var task = "- [ ] ";
				if (this.settings.isNeedToAddCreatedAtDateOnToday) {
					task += " ➕ {{date}}";
				}
				if (this.settings.isNeedToAddScheduledDateOnToday) {
					task += " ⏳ {{date}}";
				}
				var now = moment().format("YYYY-MM-DD");
				while (task.contains('{{date}}')) {
					task = task.replace('{{date}}', now)
				}
				editor.replaceSelection(task);
				
				// adjust cursor position
                const cursor = editor.getCursor();
                const lineContent = editor.getLine(cursor.line);
				editor.setLine(cursor.line, lineContent.replace('- [ ] ', ''));

				this.adjustCursorPosition(editor, lineContent, ']', 1);
			}
		});
		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'sample-editor-command',
		// 	name: 'Sample editor command',
		// 	editorCallback: (editor: Editor, _view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection('Sample Editor Command');
		// 	}
		// });
		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-sample-modal-complex',
		// 	name: 'Open sample modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	}
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TasksPluginEnhancerSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, TASKS_PLUGIN_ENHANCER_DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async adjustCursorPosition(editor: Editor, lineContent: String, afterSubstring: string, rightShift: number) {
		const cursor = editor.getCursor();
		const starPosition = lineContent.indexOf(afterSubstring);
		if (starPosition !== -1) {
			editor.setCursor({
				line: cursor.line,
				ch: starPosition + rightShift + 1
			});
		} else {
			console.log("Unable to set cursor position for line <" + lineContent + "> after <" + afterSubstring + ">");
		}
	}
}

// class SampleModal extends Modal {
// 	constructor(app: App) {
// 		super(app);
// 	}

// 	onOpen() {
// 		const {contentEl} = this;
// 		contentEl.setText('Woah!');
// 	}

// 	onClose() {
// 		const {contentEl} = this;
// 		contentEl.empty();
// 	}
// }

class TasksPluginEnhancerSettingTab extends PluginSettingTab {
	plugin: TasksPluginEnhancer;

	constructor(app: App, plugin: TasksPluginEnhancer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Task creation')
			.setHeading();

		new Setting(containerEl)
			.setName('Need to add date of creation of task')
			.setDesc('Add current date as date of creation while creating of task')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isNeedToAddCreatedAtDateOnToday)
				.onChange(async (value) => {
					this.plugin.settings.isNeedToAddCreatedAtDateOnToday = value
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName('Need to add date of scheduling to task')
			.setDesc('Add current date as date of scheduling while creating of task')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isNeedToAddScheduledDateOnToday)
				.onChange(async (value) => {
					this.plugin.settings.isNeedToAddScheduledDateOnToday = value
					await this.plugin.saveSettings();
				})
			);
	}
}
