/* Storage management */
class CustomBlockerStorage {
	static JSON_WORD_FLAG_REGEXP: number;
	static JSON_WORD_FLAG_COMPLETE_MATCHING: number;
	static JSON_WORD_FLAG_CASE_SENSITIVE: number;
	static JSON_WORD_FLAG_INCLUDE_HREF: number;
	static JSON_RULE_CONVERSION_RULE: [[string]];
	
	public createRule (): Rule {
		return {
			dirty: false,
			isNew: false,
			deleted: false,
			insert_date: 0,
			update_date: 0,
			delete_date: 0,
			updaterId: null,
			words: [] as [Word],
			wordGroups: [] as [WordGroup],
			hideNodes: [] as [HTMLElement],
			searchNodes: [] as [HTMLElement],
			hiddenCount: 0,
			staticXpath: null,
			
			appliedWords:null,
			is_disabled:false,
 	
 			rule_id: 0,
 			user_identifier: null,
 			global_identifier: null,
 			title: null,
 			url: null,
 			site_regexp: null,
 			example_url: null,
 	
		 	search_block_css: null,
 			search_block_xpath: null,
 			search_block_by_css: true,
 	
 			hide_block_css: null,
 			hide_block_xpath: null,
 			hide_block_by_css: true,
 	
 			block_anyway: false,
 			specify_url_by_regexp: false,
 			existing: false
		};
	}
	
	public createWord (): Word {
		return {
			word_id:0,
			rule_id:0,
			word:null,
			newWord: null,
			
			is_regexp:false,
			is_complete_matching:false,
			is_case_sensitive:false,
			is_include_href:false,
			
			dirty:false,
			isNew:false,
			deleted:false,
			insert_date:0,
			update_date:0,
			delete_date:0,
			
		 	regExp:null, 
		 	
		 	checkedNodes: [] as [HTMLElement]
		};
	}
	
	// Save & load
	public loadAll (callback:([Rule])=>void): void {
		console.log("loadAll TODO");
		let scope = this;
		chrome.storage.sync.get(null, function (allObj) {
			console.log(allObj);
			let rules = [] as [Rule];
			for (let key in allObj) {
				if (key.indexOf("R-")==0) {
					let rule = cbStorage.createRule();
					scope.initRuleByJSON(rule, allObj[key]);
					rules.push(rule);
				} else {
					console.log("Invalid key: " + key);
				}
			}
			
			scope.getDisabledRuleIDList(function(ids) {
				// Load disabled rule list (if needed) from local storage and set is_disabled values
				for (let rule of rules) {
					for (let ruleId of ids) {
						if (rule.global_identifier==ruleId) {
							rule.is_disabled = true;
							break;
						}
					}
				}
				callback(rules);
			
			}, false);
		});
	}
	
	
	disabledRuleIDList:[string];
	private getDisabledRuleIDList (callback:([string])=>void, useCache: boolean) {
		if (this.disabledRuleIDList && useCache) {
			callback(this.disabledRuleIDList);
			return;
		}
		let scope = this;
		chrome.storage.local.get(["disabledRules"], function(result) {
			if (result["disabledRules"]) {
				scope.disabledRuleIDList = result["disabledRules"];
			} else {
				// Set empty array to tell that storage is already read.
				scope.disabledRuleIDList = [] as [string];
			}
			callback(scope.disabledRuleIDList);
		});
	}
	
	public disableRule (rule:Rule, callback:()=>void) {
		let scope = this;
		rule.is_disabled = true;
		this.getDisabledRuleIDList(function(ids) {
			scope.disabledRuleIDList.push(rule.global_identifier);
			console.log("disabledRuleIdList=");
			console.log(scope.disabledRuleIDList);
			chrome.storage.local.set({disabledRules:scope.disabledRuleIDList}, callback);
		}, true);
	}
	public enableRule (rule:Rule, callback:()=>void) {
		let scope = this;
		rule.is_disabled = false;
		this.getDisabledRuleIDList(function(ids) {
			for (let i=scope.disabledRuleIDList.length-1; i>=0; i--) {
				if (scope.disabledRuleIDList[i]===rule.global_identifier) {
					scope.disabledRuleIDList.splice(i, 1); break;
				}
			}
			console.log("disabledRuleIdList=");
			console.log(scope.disabledRuleIDList);
			chrome.storage.local.set({disabledRules:scope.disabledRuleIDList}, callback);
		}, true);
	}
	public toggleRule (rule:Rule, callback:()=>void) {
		if (rule.is_disabled) {
			this.enableRule(rule, callback);
		} else {
			this.disableRule(rule, callback);
		}
	}
	
	public saveRule (rule:Rule, callback:()=>void) {
		if (CustomBlockerUtil.isEmpty(rule.global_identifier)) {
			rule.global_identifier = UUID.generate();
			console.log("UUID is generated. " + rule.global_identifier);
		}
		let scope = this;
		this.getDeviceId(function(deviceId:string){
			let obj = {};
			rule.updaterId = deviceId;
			console.log("Updater id set. " + rule.updaterId);
			let jsonObj = scope.convertRuleToJSON(rule);
			// TODO
			console.log(document.getElementById('rule_editor_save_merge_checkbox'))
			if (document.getElementById('rule_editor_save_merge_checkbox') && (document.getElementById('rule_editor_save_merge_checkbox') as HTMLInputElement).checked) {
				console.log("rule is checked!");
				jsonObj["merge"] = true;
			}
			console.log(jsonObj);
			
			obj[scope.getRuleJSONKey(rule)] = jsonObj;
			
			chrome.storage.sync.set(obj, function() {
				console.log("Saved rule.");
				if (callback) {
					callback();
				}
			});
		});
	}
	
	public static createWordInstance (url:string, title:string): Rule {
		let rule = cbStorage.createRule();
		rule.title = title;
		rule.site_regexp = url;
		rule.example_url = url;
		return rule;
	}
	
	public deleteRule (rule:Rule, callback: ()=>void) {
		chrome.storage.sync.remove(this.getRuleJSONKey(rule), function() {
			console.log("Deleted rule.");
			if (callback) {
				callback();
			}
		});
	}
	
	public addWordToRule (rule:Rule, word:Word) {
		rule.words.push(word);	
	}
	
	public removeWordFromRule (rule:Rule, word:Word) {
		let wordIndex = rule.words.indexOf(word);
		if (wordIndex >= 0) {
		  rule.words.splice(wordIndex, 1);
		}
	}
	
	public getRuleJSONKey (rule:Rule): string {
		return "R-" + rule.global_identifier;
	}
	
	public convertRuleToJSON (rule:Rule): object {
		let obj = {};
		for (let prop of CustomBlockerStorage.JSON_RULE_CONVERSION_RULE) {
			obj[prop[1]] = (rule as object)[prop[0]];
		}
		obj["w"] = []; // Words
		obj["wg"] = []; // Word group
		for (let word of rule.words) {
			obj["w"].push(this.convertWordToJSON(word));
		}
		/*
		
		for (let wordGroup of this.wordGroups) {
			obj["wg"].push(wordGroup.getJSON();
		}
		*/
		return obj;
	}
	
	public convertWordToJSON (word:Word): any {
		let flags = [] as [number];
		if (word.is_regexp) { flags.push(CustomBlockerStorage.JSON_WORD_FLAG_REGEXP); }
		if (word.is_complete_matching) { flags.push(CustomBlockerStorage.JSON_WORD_FLAG_COMPLETE_MATCHING); }
		if (word.is_case_sensitive) { flags.push(CustomBlockerStorage.JSON_WORD_FLAG_CASE_SENSITIVE); }
		if (word.is_include_href) { flags.push(CustomBlockerStorage.JSON_WORD_FLAG_INCLUDE_HREF); }
		
		if (flags.length > 0) {
			let obj = {};
			obj["w"] = word.word;
			obj["f"] = flags;
			return obj;
		} else {
			return word.word;
		}
	}
	
	public createRuleByJSON (json:object): Rule {
		let rule = cbStorage.createRule();
		return rule;
	}
	public initRuleByJSON (rule:Rule, json:object): Rule {
		// TODO
		for (let prop of CustomBlockerStorage.JSON_RULE_CONVERSION_RULE) {
			(rule as object)[prop[0]] = json[prop[1]]; 
		}
		rule.words = [];
		rule.wordGroups = [];
		let words = json["w"] as [any];
		let wordGroups = json["wg"] as [any];
		for (let word of words) {
			let wordObj = this.createWord();
			this.initWordByJSON(wordObj, word);
			rule.words.push(wordObj);
		}
		return rule;
	}
	
	public initWordByJSON (word:Word, obj:any): void {
		if (typeof(obj)=="string") {
			word.word = obj as string;
		} else {
			let jsonObj = obj as object;
			word.word = jsonObj["w"];
			if (jsonObj["f"]) {
				// Flags
				let flags = jsonObj["f"] as [number];
				for (let flagNum of flags) {
					if (flagNum==CustomBlockerStorage.JSON_WORD_FLAG_REGEXP) { word.is_regexp = true; }
					if (flagNum==CustomBlockerStorage.JSON_WORD_FLAG_COMPLETE_MATCHING) { word.is_complete_matching = true; }
					if (flagNum==CustomBlockerStorage.JSON_WORD_FLAG_CASE_SENSITIVE) { word.is_case_sensitive = true; }
					if (flagNum==CustomBlockerStorage.JSON_WORD_FLAG_INCLUDE_HREF) { word.is_include_href = true; }
				}
			}
		}
	}
	
	public validateRule (params:RuleValidation): string[] {
		let errors:string[] = [];
		if (''==params.title) errors.push(chrome.i18n.getMessage('errorTitleEmpty'));
		if (''==params.site_regexp) errors.push(chrome.i18n.getMessage('errorSiteRegexEmpty'));
		if (''!=params.search_block_xpath) {
			try {
				CustomBlockerUtil.getElementsByXPath(params.search_block_xpath);
			}
			catch (e) {
				errors.push(chrome.i18n.getMessage('errorHideXpathInvalid'));
			}
		}
		if (''!=params.hide_block_xpath) {
			try {
				CustomBlockerUtil.getElementsByXPath(params.hide_block_xpath);
			}
			catch (e) {
				errors.push(chrome.i18n.getMessage('errorSearchXpathInvalid'));
			}
		}
		return errors;
	}
	
	private mergeRules (localObj:object, remoteObj:object): object {
		let remoteWords = remoteObj["w"] as [any];
		let localWords = localObj["w"] as [any];
		for (let remoteWord of remoteWords) {
			let duplicate = false;
			for (let localWord of localWords) {
				if (JSON.stringify(localWord)==JSON.stringify(remoteWord)) {
					duplicate = true;
				}
			}
			if (!duplicate) {
				(localObj["w"] as [any]).push(remoteWord);
			}
		}
		return localObj;
	}
	
	private syncRule (deviceId:string, key:string, oldValue:object, newValue:object, onLocalChange:()=>void) {
			console.log("Key=%s", key);
			console.log(oldValue);
			console.log(newValue);
			if (newValue && newValue["ui"]==deviceId) {
				console.log("Local change.");
				// Received local change event. Just reload tabs.
				onLocalChange();
				return;
			}
			
			if (newValue==null) {
				// Deleted manually. Just accept it.
			} else if (oldValue==null) {
				// Added
				// Just accept and keep sql flag.
			} else {
				// Updated
				if (newValue["merge"]) {
					// Migration on a remote device. Merge and save.
					let merged =  this.mergeRules(oldValue, newValue);
					merged["ui"] = deviceId;
					let obj = {};
					obj[key] = merged;
					chrome.storage.sync.set(obj, function() {
						console.log("Merged rule was saved.");
					});
				}
			}
	}
	
	sync (changes, namespace, onLocalChange:()=>void) {
		console.log("Syncing namespace %s", namespace);
		let scope = this;
		this.getDeviceId(function(deviceId:string) {
			for (let key in changes) {
				let change = changes[key];
				if (key=="disabledRules") {
					if (onLocalChange) {
						onLocalChange();
					}
				} else {
					scope.syncRule(deviceId, key, change.oldValue, change.newValue, onLocalChange);
				}
			}
		});
	}
	
	private deviceId = null; 
	getDeviceId (callback:(string)=>void) {
		if (this.deviceId) {
			// deviceId is already loaded.
			callback(this.deviceId);
			return;
		}
		let scope = this;
		chrome.storage.local.get(["deviceId"], function(result) {
			if (result["deviceId"]) {
				// Loaded existing deviceId
				scope.deviceId = result["deviceId"];
				callback(scope.deviceId);
				return;
			}
			// deviceID does not exist. Generate...
			scope.deviceId = UUID.generate();
			chrome.storage.local.set({deviceId:scope.deviceId}, function(){
				callback(scope.deviceId);
			});
		});
	}
	
	// Initialize static fields
	static init () {
		CustomBlockerStorage.JSON_RULE_CONVERSION_RULE = [
			["global_identifier", "g"],
			["title", "t"],
			["url", "uu"],
			["specify_url_by_regexp", "ur"],
			["site_regexp", "ux"],
			["example_url", "ue"],
			["search_block_css", "sc"],
			["search_block_xpath", "sx"],
			["search_block_by_css", "st"],
			["hide_block_css", "hc"],
			["hide_block_xpath", "hx"],
			["hide_block_by_css", "ht"],
			["insert_date", "di"],
			["update_date", "du"],
			["updaterId", "ui"],
			
			["block_anyway", "b"]
		];
		CustomBlockerStorage.JSON_WORD_FLAG_REGEXP = 1;
		CustomBlockerStorage.JSON_WORD_FLAG_COMPLETE_MATCHING = 2;
		CustomBlockerStorage.JSON_WORD_FLAG_CASE_SENSITIVE = 3;
		CustomBlockerStorage.JSON_WORD_FLAG_INCLUDE_HREF = 4;
	}
	
	
}


CustomBlockerStorage.init();
let cbStorage = new CustomBlockerStorage();
