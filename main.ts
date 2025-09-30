import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { default as dayjs } from 'dayjs';


interface TasksPluginEnhencerSettings {
	isNeedToAddCreatedAtDateOnToday: boolean;
	isNeedToAddScheduledDateOnToday: boolean;
}

const TASKS_PLUGIN_ENHANCER_DEFAULT_SETTINGS: TasksPluginEnhencerSettings = {
	isNeedToAddCreatedAtDateOnToday: true,
	isNeedToAddScheduledDateOnToday: true
}

interface TaskBlock {
    start: number;
    end: number;
    lines: string[];
}

type TasksEnhancerAction = (editor: Editor, taskContent: string) => string;


export default class TasksPluginEnhancer extends Plugin {
	settings: TasksPluginEnhencerSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'tasks-enhancer-new-task',
			name: 'New Task',
			editorCallback: (editor: Editor) => {
				this.performAction(editor, (editor: Editor, taskContent: string) => {
					// Get current date
					const now = dayjs().format("YYYY-MM-DD");
					
					// Check if creation date is needed and not already present
					if (this.settings.isNeedToAddCreatedAtDateOnToday && !taskContent.includes('➕')) {
						taskContent += " ➕ " + now;
					}
					
					// Check if scheduled date is needed and not already present
					if (this.settings.isNeedToAddScheduledDateOnToday && !taskContent.includes('⏳')) {
						taskContent += " ⏳ " + now;
					}

					return taskContent;
				});
			}
		});
		this.addCommand({
			id: 'tasks-enhancer-start-work',
			name: 'Start working on task',
			editorCallback: (editor: Editor) => {
				this.performAction(editor, (editor: Editor, taskContent: string) => {
					// Get current date
					const now = dayjs().format("YYYY-MM-DD");
					
					// Check if start date is needed and not already present
					if (!taskContent.includes('🛫')) {
						taskContent += " 🛫 " + now;
					}

					return taskContent;
				});
			}
		});
		this.addCommand({
			id: 'tasks-enhancer-move-block-up',
			name: 'Move block up',
			editorCallback: (editor: Editor) => {
				this.moveTaskBlock(editor, 'up');
			}
		});
		this.addCommand({
			id: 'tasks-enhancer-move-block-down',
			name: 'Move block down',
			editorCallback: (editor: Editor) => {
				this.moveTaskBlock(editor, 'down');
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TasksPluginEnhancerSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, TASKS_PLUGIN_ENHANCER_DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private performAction(editor: Editor, action: TasksEnhancerAction) {
		const cursor = editor.getCursor();
		const lineContent = editor.getLine(cursor.line);
		const trimmedContent = lineContent.trim();
		
		// skip if task is done
		if (trimmedContent.startsWith('- [') && !trimmedContent.startsWith('- [ ')) {
			return;
		}

		// Get the original indentation
		const indentMatch = lineContent.match(/^(\s*)/);
		const originalIndent = indentMatch ? indentMatch[1] : '';
		
		let taskContent = '';
		// Start building the task with original indentation
		if (!trimmedContent.startsWith('- [')) {
			taskContent = originalIndent + "- [ ] " + trimmedContent;
		} else {
			taskContent = originalIndent + trimmedContent;
		}

		taskContent = action(editor, taskContent);
		
		// Replace the entire line
		editor.setLine(cursor.line, taskContent);
		
		// Adjust cursor position to be after the checkbox
		this.adjustCursorPosition(editor, taskContent, ']', 1);
	}

	private adjustCursorPosition(editor: Editor, lineContent: String, afterSubstring: string, rightShift: number) {
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

	// *************************************************************************************

	private moveTaskBlock(editor: Editor, direction: 'up' | 'down') {
        const cursor = editor.getCursor();
        const line = cursor.line;
        const content = editor.getLine(line);
        
        //console.log('Starting moveTaskBlock, direction:', direction, 'line:', line, 'content:', content);

        if (!content.trim().startsWith('- [')) {
            console.log('Not a task, exiting');
            return;
        }

        const currentIndent = this.getIndentLevel(content);
        //console.log('Current indent:', currentIndent);

        const taskBlock = this.findTaskBlock(editor, line, currentIndent);
        if (!taskBlock) {
            console.log('No task block found');
            return;
        }
        //console.log('Task block:', taskBlock);

        // Проверяем границы для перемещения вверх
        if (direction === 'up') {
            const canMoveUp = this.canMoveUp(editor, taskBlock.start);
            if (!canMoveUp) {
                console.log('Cannot move up - boundary reached');
                return;
            }
        }
        
        // Проверяем границы для перемещения вниз
        if (direction === 'down') {
            const canMoveDown = this.canMoveDown(editor, taskBlock.end);
            if (!canMoveDown) {
                console.log('Cannot move down - boundary reached');
                return;
            }
        }

        let targetLine: number;
        
        if (direction === 'up') {
            targetLine = this.findTargetLineUp(editor, line, currentIndent);
        } else {
            // Для перемещения вниз находим конец следующего блока
            targetLine = this.findTargetLineDown(editor, taskBlock.end, currentIndent);
        }
        
        //console.log('Target line:', targetLine);

        if (targetLine === -1 || targetLine === taskBlock.start) {
            console.log('Invalid target line, exiting');
            return;
        }

        this.moveBlockSimple(editor, taskBlock, targetLine, direction, cursor.ch);
    }

    private canMoveUp(editor: Editor, startLine: number): boolean {
        // Проверяем, есть ли выше задачи с таким же или меньшим отступом
        for (let line = startLine - 1; line >= 0; line--) {
            const lineContent = editor.getLine(line);
            
            // Пропускаем пустые строки
            if (lineContent.trim() === '') continue;
            
            // Если нашли задачу - можно перемещаться
            if (lineContent.trim().startsWith('- [')) {
                return true;
            }
            
            // Если нашли не-задачу (текст, заголовок и т.д.) - граница
            return false;
        }
        
        // Дошли до начала файла - граница
        return false;
    }

    private canMoveDown(editor: Editor, endLine: number): boolean {
        const totalLines = editor.lineCount();
        
        // Проверяем, есть ли ниже задачи с таким же или меньшим отступом
        for (let line = endLine + 1; line < totalLines; line++) {
            const lineContent = editor.getLine(line);
            
            // Пропускаем пустые строки
            if (lineContent.trim() === '') continue;
            
            // Если нашли задачу - можно перемещаться
            if (lineContent.trim().startsWith('- [')) {
                return true;
            }
            
            // Если нашли не-задачу (текст, заголовок и т.д.) - граница
            return false;
        }
        
        // Дошли до конца файла - граница
        return false;
    }

    private getIndentLevel(line: string): number {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }

    private findTaskBlock(editor: Editor, startLine: number, baseIndent: number): TaskBlock | null {
        const lines: string[] = [];
        let currentLine = startLine;
        const totalLines = editor.lineCount();

        lines.push(editor.getLine(startLine));

        currentLine = startLine + 1;
        while (currentLine < totalLines) {
            const lineContent = editor.getLine(currentLine);
            const indent = this.getIndentLevel(lineContent);
            
            if (indent > baseIndent) {
                lines.push(lineContent);
                currentLine++;
            } else {
                break;
            }
        }

        return {
            start: startLine,
            end: startLine + lines.length - 1,
            lines: lines
        };
    }

    private findTargetLineUp(editor: Editor, startLine: number, targetIndent: number): number {
        for (let line = startLine - 1; line >= 0; line--) {
            const lineContent = editor.getLine(line);
            if (lineContent.trim() === '') continue;
            
            const indent = this.getIndentLevel(lineContent);
            if (indent === targetIndent) {
                return line;
            }
            if (indent < targetIndent) {
                return line + 1;
            }
        }
        return 0;
    }

    private findTargetLineDown(editor: Editor, endLine: number, targetIndent: number): number {
        const totalLines = editor.lineCount();
        //console.log('Finding target line down from:', endLine, 'total lines:', totalLines);
        
        // Находим следующий блок с таким же отступом
        let nextBlockStart = -1;
        for (let line = endLine + 1; line < totalLines; line++) {
            const lineContent = editor.getLine(line);
            if (lineContent.trim() === '') continue;
            
            const indent = this.getIndentLevel(lineContent);
            if (indent <= targetIndent) {
                nextBlockStart = line;
                break;
            }
        }
        
        if (nextBlockStart === -1) {
            console.log('No next block found, returning end:', totalLines);
            return totalLines;
        }
        
        // Находим полный блок (с подзадачами) для этого начала
        const nextBlock = this.findTaskBlock(editor, nextBlockStart, targetIndent);
        if (!nextBlock) {
            console.log('Could not find next block details, returning start:', nextBlockStart);
            return nextBlockStart;
        }
        
        //console.log('Next block ends at:', nextBlock.end);
        // Возвращаем позицию ПОСЛЕ конца следующего блока
        return nextBlock.end + 1;
    }

    private moveBlockSimple(editor: Editor, block: TaskBlock, targetLine: number, direction: 'up' | 'down', originalCursorPos: number) {
        //console.log('Moving block from', block.start, '-', block.end, 'to', targetLine);
        
        // Получаем весь текст
        const content = editor.getValue();
        const lines = content.split('\n');
        
        //console.log('Total lines before:', lines.length);
        
        // Удаляем блок из исходной позиции
        const linesWithoutBlock = [
            ...lines.slice(0, block.start),
            ...lines.slice(block.end + 1)
        ];
        
        //console.log('Lines without block:', linesWithoutBlock.length);
        
        // Корректируем целевую позицию
        let adjustedTargetLine = targetLine;
        if (targetLine > block.end) {
            // После удаления блока, позиция смещается на размер удаленного блока
            adjustedTargetLine = targetLine - (block.end - block.start + 1);
        }
        
        //console.log('Adjusted target line:', adjustedTargetLine);
        
        // Вставляем блок в новую позицию
        const newLines = [
            ...linesWithoutBlock.slice(0, adjustedTargetLine),
            ...block.lines,
            ...linesWithoutBlock.slice(adjustedTargetLine)
        ];
        
        //console.log('Total lines after:', newLines.length);
        
        // Обновляем редактор
        editor.setValue(newLines.join('\n'));
        
        // Устанавливаем курсор на той же строке и в той же позиции
        let newCursorLine = adjustedTargetLine;
        
        // Если курсор был в перемещенной строке, он останется в ней
        if (originalCursorPos > 0) {
            // Сохраняем позицию в строке
            editor.setCursor({ line: newCursorLine, ch: Math.min(originalCursorPos, editor.getLine(newCursorLine).length) });
        } else {
            // Или просто в начало строки
            editor.setCursor({ line: newCursorLine, ch: 0 });
        }
        
        //console.log('Move completed');
    }

	// **********************************************************************************************
}

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
