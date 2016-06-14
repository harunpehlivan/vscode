/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import strings = require('vs/base/common/strings');
import { $ } from 'vs/base/browser/builder';
import {IExpression, splitGlobAware} from 'vs/base/common/glob';
import { Checkbox } from 'vs/base/browser/ui/checkbox/checkbox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { MessageType, InputBox, IInputValidator } from 'vs/base/browser/ui/inputbox/inputBox';

export interface IOptions {
	placeholder?: string;
	width?: number;
	validation?: IInputValidator;
	ariaLabel?: string;
}

export class PatternInput {

	static OPTION_CHANGE: string = 'optionChange';

	private contextViewProvider: IContextViewProvider;
	private onOptionChange: (event: Event) => void;
	private width: number;
	private placeholder: string;
	private ariaLabel: string;

	private listenersToRemove: any[];
	private pattern: Checkbox;
	public domNode: HTMLElement;
	private inputNode: HTMLInputElement;
	private inputBox: InputBox;

	constructor(parent: HTMLElement, contextViewProvider: IContextViewProvider, options: IOptions = Object.create(null)) {
		this.contextViewProvider = contextViewProvider;
		this.onOptionChange = null;
		this.width = options.width || 100;
		this.placeholder = options.placeholder || '';
		this.ariaLabel = options.ariaLabel || nls.localize('defaultLabel', "input");

		this.listenersToRemove = [];
		this.pattern = null;
		this.domNode = null;
		this.inputNode = null;
		this.inputBox = null;

		this.buildDomNode();

		if (Boolean(parent)) {
			parent.appendChild(this.domNode);
		}
	}

	public destroy(): void {
		this.pattern.dispose();
		this.listenersToRemove.forEach((element) => {
			element();
		});
		this.listenersToRemove = [];
	}

	public on(eventType: string, handler: (event: Event) => void): PatternInput {
		switch (eventType) {
			case 'keydown':
			case 'keyup':
				$(this.inputBox.inputElement).on(eventType, handler);
				break;
			case PatternInput.OPTION_CHANGE:
				this.onOptionChange = handler;
				break;
		}
		return this;
	}

	public setWidth(newWidth: number): void {
		this.width = newWidth;
		this.domNode.style.width = this.width + 'px';
		this.contextViewProvider.layout();
		this.setInputWidth();
	}

	public getValue(): string {
		return this.inputBox.value;
	}

	public setValue(value: string): void {
		if (this.inputBox.value !== value) {
			this.inputBox.value = value;
		}
	}

	public getGlob(): IExpression {
		let pattern = this.getValue();
		let isGlobPattern = this.isGlobPattern();

		if (!pattern) {
			return void 0;
		}

		let glob: IExpression = Object.create(null);

		let segments: string[];
		if (isGlobPattern) {
			segments = splitGlobAware(pattern, ',').map(s => s.trim()).filter(s => !!s.length);
		} else {
			segments = pattern.split(',').map(s => strings.trim(s.trim(), '/')).filter(s => !!s.length).map(p => {
				if (p[0] === '.') {
					p = '*' + p; // convert ".js" to "*.js"
				}

				return strings.format('{{0}/**,**/{1}}', p, p); // convert foo to {foo/**,**/foo} to cover files and folders
			});
		}

		return segments.reduce((prev, cur) => { glob[cur] = true; return glob; }, glob);
	}

	public select(): void {
		this.inputBox.select();
	}

	public focus(): void {
		this.inputBox.focus();
	}

	public isGlobPattern(): boolean {
		return this.pattern.checked;
	}

	public setIsGlobPattern(value: boolean): void {
		this.pattern.checked = value;
		this.setInputWidth();
	}

	private setInputWidth(): void {
		let w = this.width - this.pattern.width();
		this.inputBox.width = w;
	}

	private buildDomNode(): void {
		this.domNode = document.createElement('div');
		this.domNode.style.width = this.width + 'px';
		$(this.domNode).addClass('monaco-findInput');

		this.inputBox = new InputBox(this.domNode, this.contextViewProvider, {
			placeholder: this.placeholder || '',
			ariaLabel: this.ariaLabel || '',
			validationOptions: {
				validation: null,
				showMessage: true
			}
		});

		this.pattern = new Checkbox({
			actionClassName: 'pattern',
			title: nls.localize('patternDescription', "Use Glob Patterns"),
			isChecked: false,
			onChange: (viaKeyboard) => {
				this.onOptionChange(null);
				if (!viaKeyboard) {
					this.inputBox.focus();
				}
				this.setInputWidth();

				if (this.isGlobPattern()) {
					this.showGlobHelp();
				} else {
					this.inputBox.hideMessage();
				}
			}
		});

		$(this.pattern.domNode).on('mouseover', () => {
			if (this.isGlobPattern()) {
				this.showGlobHelp();
			}
		});

		$(this.pattern.domNode).on(['mouseleave', 'mouseout'], () => {
			this.inputBox.hideMessage();
		});

		this.setInputWidth();

		let controls = document.createElement('div');
		controls.className = 'controls';
		controls.appendChild(this.pattern.domNode);

		this.domNode.appendChild(controls);
	}

	private showGlobHelp(): void {
		this.inputBox.showMessage({
			type: MessageType.INFO,
			formatContent: true,
			content: nls.localize('patternHelpInclude',
				"The pattern to match. e.g. **\\*\\*/*.js** to match all JavaScript files or **myFolder/\\*\\*** to match that folder with all children.\n\n**Reference**:\n**\\*** matches 0 or more characters\n**?** matches 1 character\n**\\*\\*** matches zero or more directories\n**[a-z]** matches a range of characters\n**{a,b}** matches any of the patterns)"
			)
		}, true);
	}
}