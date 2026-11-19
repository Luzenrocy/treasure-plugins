(function () {
  'use strict';
  var app = document.getElementById('mindmap-app');
  var NATIVE_EXTENSION = 'gxp';
  var $ = function (id) { return document.getElementById(id); };
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var uid = 30, epoch = 0, toastTimer, layoutCache, lastTrigger, lastTriggerKey, lastActionKey, inspectorTriggerKey, menuTriggerKey, exportingUrls = [];
  var measure = document.createElement('canvas').getContext('2d');
  var paths = {
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    map:'<rect x="8" y="9" width="8" height="6" rx="2"/><path d="M4 5v5h4M4 19v-5h4M16 12h4V5M16 12h4v7"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
    chevron:'<path d="m8 10 4 4 4-4"/>',
    right:'<path d="m9 5 7 7-7 7"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    minus:'<path d="M5 12h14"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/>',
    save:'<path d="M4 4h13l3 3v13H4Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    export:'<path d="M9 5H4v15h15v-5M12 4h8v8M10 14 20 4"/>',
    undo:'<path d="M9 7H4V2M4 7c4-6 15-3 15 5a7 7 0 0 1-11 6"/>',
    redo:'<path d="M15 7h5V2M20 7C16 1 5 4 5 12a7 7 0 0 0 11 6"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a2 2 0 0 0 2-2 9 9 0 0 0-9-9Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6" r="1"/><circle cx="16" cy="7" r="1"/>',
    tree:'<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/>',
    outline:'<path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1"/>',
    fit:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    target:'<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    trash:'<path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    file:'<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M9 12h6M9 16h6"/>',
    note:'<path d="M4 3h16v14l-4 4H4Z"/><path d="M8 8h8M8 12h6M15 21v-5h5"/>',
    child:'<path d="M5 4v8a4 4 0 0 0 4 4h9M14 12l4 4-4 4"/>',
    sibling:'<path d="M4 5h15M4 12h9M17 9v10M12 14h10"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    alert:'<path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 17h.01"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    keyboard:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1M11 9h1M16 9h1M6 13h1M11 13h1M16 13h1M8 16h8"/>'
  };
  function icon(name, size) { return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.file) + '</svg>'; }
  function btn(act, label, ico, cls, extra) { return '<button type="button" data-act="' + act + '" class="' + (cls || 'button') + '" ' + (extra || '') + '>' + (ico ? icon(ico) : '') + label + '</button>'; }
  function ibtn(act, label, ico, extra) { return btn(act, '', ico, 'icon-button', 'aria-label="' + esc(label) + '" title="' + esc(label) + '" ' + (extra || '')); }
  function focusKey(el) { var t=el&&el.closest&&el.closest('[data-act]');return t?{act:t.dataset.act,id:t.dataset.id||null}:null; }
  function restoreFocus(key,oldElement) {
    var target=null;
    if(key)target=Array.from(app.querySelectorAll('[data-act="'+CSS.escape(key.act)+'"]')).find(function(el){return (!key.id||el.dataset.id===key.id)&&!el.disabled&&el.offsetParent!==null&&!el.closest('[inert]');});
    if(!target&&oldElement&&document.contains(oldElement)&&oldElement.offsetParent!==null&&!oldElement.closest('[inert]'))target=oldElement;
    if(!target&&key&&['close-file','clear','shortcuts','open'].includes(key.act))target=app.querySelector('[data-act="file-menu"]');
    if(!target&&key&&key.act==='request-delete')target=Array.from(app.querySelectorAll('[data-act="file-options"]')).find(function(el){return el.dataset.id===key.id;});
    (target||$('viewport')).focus({preventScroll:true});
  }
  function tree(id, text, children, side) { return {id:id,text:text,children:children || [],side:side || null,collapsed:false,collapsedLeft:false,collapsedRight:false,collapsedDown:false,note:'',fill:null}; }
  function rootChildSide(layout, child, index, total) {
    if(layout==='down')return 'down';
    if(layout==='right')return 'right';
    return child.side||(index<Math.ceil(total/2)?'right':'left');
  }
  function rootCollapseKey(side) { return side==='left'?'collapsedLeft':side==='down'?'collapsedDown':'collapsedRight'; }
  function isRootFullyCollapsed(s) {
    var root=s&&s.root,branches={};if(!root||!root.children.length)return false;
    root.children.forEach(function(child,index){branches[rootChildSide(s.layout,child,index,root.children.length)]=true;});
    return Object.keys(branches).every(function(branch){return !!root[rootCollapseKey(branch)];});
  }
  function productTree() {
    return tree('root','产品设计',[
      tree('experience','用户体验',[tree('themes','柔和主题'),tree('keyboard','键盘操作')],'right'),
      tree('architecture','技术架构',[tree('engine','导图内核'),tree('adapters','格式适配')],'right'),
      tree('files','文件管理',[],'left'),
      tree('formats','格式兼容',[],'left')
    ]);
  }
  function sheet(id, name, root) { return {id:id,name:name,root:root,layout:'both',theme:'wisteria'}; }
  function docData(d) { return clone({name:d.name,format:d.format,sheets:d.sheets,activeSheetId:d.activeSheetId,imported:d.imported || false,sourceName:d.sourceName||null}); }
  function makeDoc(id, name, format, sheets) {
    var d={id:id,name:name,format:format,sheets:sheets,activeSheetId:sheets[0].id,revision:0,savedRevision:0,undo:[],redo:[],imported:false};
    d.baseline=docData(d); return d;
  }
  function samples() {
    return [
      makeDoc('product','产品设计.gxp','native',[sheet('product-main','产品设计',productTree())]),
      makeDoc('reading','读书笔记.smm','smm',[sheet('reading-main','读书笔记',tree('read-root','读书笔记',[
        tree('read-one','核心观点',[tree('read-a','把问题写清楚')],'right'),
        tree('read-two','行动清单',[tree('read-b','每周复盘')],'left')
      ]))]),
      makeDoc('project','项目规划.xmind','xmind',[
        sheet('project-main','项目路线',tree('project-root','项目规划',[tree('project-one','需求梳理',[tree('project-a','真实文件样本')],'right'),tree('project-two','技术验证',[tree('project-b','格式兼容')],'left')])),
        sheet('project-second','里程碑',tree('milestone-root','里程碑',[tree('milestone-one','原型评审',[],'right'),tree('milestone-two','概念验证',[],'left')]))
      ])
    ];
  }
  var state;
  function current() { return state.docs.find(function(d){return d.id===state.currentId;}) || null; }
  function currentSheet() { var d=current(); return d && (d.sheets.find(function(s){return s.id===d.activeSheetId;}) || d.sheets[0]); }
  function isDirty(d) { return !!d && d.revision!==d.savedRevision; }
  function isExternal(d) { return !!d && (d.format==='smm'||d.format==='xmind'); }
  function ensureEditable(intent) {
    if(!current()||!isExternal(current()))return true;
    state.copyIntent=intent||null;showOverlay('editable-copy');return false;
  }
  function formatFromName(name) {
    var extension=(String(name||'').match(/\.([^.]+)$/)||[])[1];
    extension=extension&&extension.toLowerCase();
    return extension===NATIVE_EXTENSION?'native':extension==='smm'?'smm':extension==='xmind'?'xmind':null;
  }
  function makeExternalPreviewDocument(name) {
    var format=formatFromName(name);
    if(!format)return null;
    /* The browser prototype deliberately uses a fixture after selection. In the
       plugin, the SDK adapter supplies bytes to the real format adapter first. */
    var fixture=samples()[format==='xmind'?2:format==='smm'?1:0];
    fixture.id='external-'+(++uid);
    fixture.name=name;
    fixture.format=format;
    fixture.imported=format!=='native';
    fixture.sourceName=format==='native'?null:name;
    fixture.undo=[];fixture.redo=[];fixture.revision=0;fixture.savedRevision=0;
    fixture.baseline=docData(fixture);
    return fixture;
  }
  function findNode(id, root) {
    root=root || (currentSheet() && currentSheet().root);
    if (!root) return null;
    if (root.id===id) return root;
    for(var i=0;i<root.children.length;i++){var found=findNode(id,root.children[i]);if(found)return found;}
    return null;
  }
  function findParent(id, root) {
    root=root || (currentSheet() && currentSheet().root);
    if(!root)return null;
    if(root.children.some(function(n){return n.id===id;}))return root;
    for(var i=0;i<root.children.length;i++){var found=findParent(id,root.children[i]);if(found)return found;}
    return null;
  }
  function allNodes(root) { return root ? [root].concat.apply([root],root.children.map(function(n){return allNodes(n);})) : []; }
  function fullState() {
    var d=current(), s=currentSheet();
    return {scenario:state.scenario,overlay:state.overlay || state.menu || 'none',inspector:state.inspector || 'none',selectedNodeId:state.selected,fileName:d?d.name:null,readOnly:isExternal(d),sourceName:d?d.sourceName||null:null,dirty:isDirty(d),saving:!!state.saving,deleting:state.deleting,sheetName:s?s.name:null,revision:d?d.revision:null,savedRevision:d?d.savedRevision:null,fileNames:state.docs.map(function(f){return f.name;}),nodeCount:s?allNodes(s.root).length:0,nodes:s?allNodes(s.root).map(function(n){return {id:n.id,text:n.text};}):[],zoom:state.zoom,workspace:state.folderName,permission:state.permission};
  }
  function notify(event) { if(window.parent!==window)window.parent.postMessage({type:'mindmap-prototype-state',state:fullState(),event:event || '状态更新'},'*'); }
  function toast(message) { clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(function(){$('toast').hidden=true;},2600); }
  function newState(scenario) {
    epoch++;
    state={epoch:epoch,scenario:scenario || 'default',docs:samples(),currentId:'product',folderName:'我的导图',folderChoice:'我的导图',permission:true,query:'',sidebarMode:'outline',selected:null,inspector:null,overlay:null,menu:null,menuFile:null,menuAnchor:null,pending:null,deferredDiscard:null,leaveCounter:0,deleting:false,guardSaving:false,saving:null,savePromise:null,loadingId:null,openCounter:0,pan:{x:0,y:0},zoom:1,autoFit:true,error:'',fail:{save:false,delete:false,open:false},exportFormat:'svg',exportRange:'current',exportTransparent:false,exportScale:'2',exportResults:[],editId:null,sheetEditId:null,lastSheetClick:null,composing:false};
    if(scenario==='selected'||scenario==='style'){state.selected='experience';if(scenario==='style')state.inspector='node';}
    if(scenario==='export')state.overlay='export';
    if(scenario==='directory')state.overlay='directory';
    if(scenario==='unsaved'||scenario==='save-error'){
      current().sheets[0].root.text='产品设计 · 待确认';current().revision=1;
      state.pending={kind:'open',id:'reading',sourceId:'product',token:++state.leaveCounter};state.overlay='unsaved';
      if(scenario==='save-error')state.fail.save=true;
    }
    if(scenario==='delete'||scenario==='deleting'||scenario==='delete-error'){
      state.deleteId='product';state.overlay='delete';
      if(scenario==='delete-error')state.fail.delete=true;
    }
    if(scenario==='compat'){state.currentId='project';state.overlay='compat';}
    if(scenario==='preview-smm')state.currentId='reading';
    if(scenario==='preview-xmind')state.currentId='project';
    if(scenario==='empty'){state.currentId=null;state.docs=[];state.folderName='空白工作目录';}
    if(scenario==='error')state.permission=false;
  }
  function reset(scenario) {
    exportingUrls.forEach(function(u){URL.revokeObjectURL(u);});exportingUrls=[];
    lastTrigger=null;lastTriggerKey=null;lastActionKey=null;inspectorTriggerKey=null;menuTriggerKey=null;panStart=null;
    newState(scenario || 'default');$('inline-editor').hidden=true;clearTimeout(toastTimer);$('toast').hidden=true;
    renderAll('重置场景'); if(state.overlay)activateDialog();
    if(scenario==='deleting'){var startEpoch=state.epoch;setTimeout(function(){if(state.epoch===startEpoch&&state.scenario==='deleting')confirmDelete();},250);}
  }
  function renderHeader() {
    var d=current(), dirty=isDirty(d);
    var saveLabel=isExternal(d)?'外部文件只读预览':state.saving?'正在保存':dirty?'保存（有未保存更改）':'保存';
    var markup='<div class="floating-group app-menu-group" role="group" aria-label="主菜单">'+
      ibtn('file-menu','主菜单','menu','aria-haspopup="menu" aria-expanded="'+(state.menu==='file')+'"')+
      '</div>'+
      '<div class="floating-group app-action-group" role="group" aria-label="保存与导出">'+
      '<span class="save-control '+(dirty?'is-dirty ':'')+(state.saving?'is-saving ':'')+'">'+ibtn('save',saveLabel,'save',!d||isExternal(d)||state.deleting||state.guardSaving||state.saving?'disabled':'')+'</span>'+
      ibtn('export','导出当前思维导图','export',!d?'disabled':'')+
      '</div>';
    var header=$('app-header');
    if(!header.querySelector('.app-menu-group'))header.innerHTML=markup;
    else {
      header.querySelector('.save-control').classList.toggle('is-dirty',dirty);
      header.querySelector('.save-control').classList.toggle('is-saving',!!state.saving);
      header.querySelector('[data-act="save"]').disabled=!d||isExternal(d)||state.deleting||state.guardSaving||!!state.saving;
      header.querySelector('[data-act="export"]').disabled=!d;
      header.querySelector('[data-act="file-menu"]').setAttribute('aria-expanded',String(state.menu==='file'));
      header.querySelector('[data-act="save"]').setAttribute('aria-label',saveLabel);
      header.querySelector('[data-act="save"]').setAttribute('title',saveLabel);
    }
  }
  function renderSidebar() {
    var side=$('file-sidebar'),d=current(), list;
    side.classList.remove('collapsed');
    function outlinePreview() {
      var root=currentSheet()&&currentSheet().root,items=[];
      function visit(node,depth) {
        items.push({id:node.id,depth:depth});
        if(node===root){
          node.children.forEach(function(child,index){var branch=rootChildSide(currentSheet().layout,child,index,node.children.length);if(!node[rootCollapseKey(branch)])visit(child,depth+1);});
        } else if(!node.collapsed)node.children.forEach(function(child){visit(child,depth+1);});
      }
      if(root)visit(root,0);
      if(!items.length)return '';
      var gap=Math.max(3,Math.min(10,Math.floor(150/items.length)));
      return '<div class="outline-preview" aria-hidden="true" style="--outline-gap:'+gap+'px">'+items.map(function(item,index){
        var active=state.selected?state.selected===item.id:index===items.length-1;
        return '<i class="outline-marker depth-'+Math.min(item.depth,2)+(active?' is-active':'')+'"></i>';
      }).join('')+'</div>';
    }
    function shell(content) {
      return outlinePreview()+'<div class="sidebar-content">'+content+'</div>';
    }
    var tabs='<div class="sidebar-tabs" role="tablist" aria-label="侧栏内容">'+btn('show-files','文件','folder',state.sidebarMode==='files'?'active':'','role="tab" aria-selected="'+(state.sidebarMode==='files')+'"')+btn('show-outline','大纲','outline',state.sidebarMode==='outline'?'active':'','role="tab" aria-selected="'+(state.sidebarMode==='outline')+'"')+'</div>';
    if(state.sidebarMode==='outline'){
      list='';
      function outline(n,depth){
        var isRoot=n===currentSheet().root,collapsed=isRoot?isRootFullyCollapsed(currentSheet()):!!n.collapsed,hasChildren=n.children.length>0;
        var control=hasChildren?'<button type="button" class="outline-toggle" data-act="collapse-node" data-id="'+esc(n.id)+'" aria-label="'+esc((collapsed?'展开':'折叠')+n.text)+'" aria-expanded="'+(!collapsed)+'">'+icon(collapsed?'right':'chevron',12)+'</button>':'<span class="outline-leaf" aria-hidden="true">'+icon('minus',12)+'</span>';
        list+='<div class="outline-row '+(state.selected===n.id?'selected':'')+'" style="--indent:'+(8+depth*15)+'px" role="treeitem" aria-level="'+(depth+1)+'" '+(hasChildren?'aria-expanded="'+(!collapsed)+'"':'')+'>'+control+'<button type="button" class="outline-select" data-act="select-node" data-id="'+esc(n.id)+'" aria-label="'+esc(n.text)+'"> <span class="outline-label">'+esc(n.text)+'</span></button></div>';
        n.children.forEach(function(c,index){var branch=n===currentSheet().root&&rootChildSide(currentSheet().layout,c,index,n.children.length);if(!n.collapsed&&(!branch||!n[rootCollapseKey(branch)]))outline(c,depth+1);});
      }
      if(currentSheet())outline(currentSheet().root,0);
      side.innerHTML=shell(tabs+'<div class="sidebar-eyebrow">'+esc(d?d.name:'当前文档')+'</div><div class="outline-list">'+(list||'<div class="empty-sidebar">打开导图后查看大纲</div>')+'</div>');
      return;
    }
    if(!state.permission){
      side.innerHTML=shell(tabs+'<div class="sidebar-eyebrow">工作目录</div><div class="permission-card">'+icon('lock',26)+'<strong>目录暂不可用</strong><span class="small muted">请重新授权或选择其他目录。已打开的内容会保留。</span>'+btn('reauthorize','重新授权',null,'button primary')+btn('directory','选择其他目录',null,'button')+'</div>');return;
    }
    list=state.docs.filter(function(f){return f.name.toLowerCase().includes(state.query.toLowerCase());}).map(function(f){
      return '<div class="file-row '+(d&&d.id===f.id?'selected':'')+'" data-act="open-file" data-id="'+esc(f.id)+'" tabindex="0" role="button" aria-label="打开 '+esc(f.name)+'" '+(d&&d.id===f.id?'aria-current="true"':'')+'><span class="file-format">'+(f.format==='xmind'?'X':f.format==='native'?'T':'S')+'</span><span class="file-row-name">'+esc(f.name)+'</span>'+(isDirty(f)?'<i class="dirty-dot"></i>':'')+btn('file-options','','more','icon-button file-options','data-id="'+esc(f.id)+'" aria-label="'+esc(f.name)+'的文件操作" aria-haspopup="menu"')+'</div>';
    }).join('');
    side.innerHTML=shell(tabs+'<div class="sidebar-eyebrow">工作目录</div><div class="folder-row">'+icon('folder',17)+'<strong>'+esc(state.folderName)+'</strong>'+ibtn('refresh','刷新目录','refresh')+ibtn('directory','更换工作目录','more')+'</div><label class="file-search">'+icon('search',14)+'<input id="file-search" aria-label="搜索文件名" placeholder="搜索文件名" value="'+esc(state.query)+'"></label><div class="file-list">'+(list||'<div class="empty-sidebar">'+(state.query?'没有匹配的文件':'这里还没有思维导图<br>创建一份新的想法。')+'</div>')+'</div>');
  }
  var themes={
    wisteria:{name:'暖白紫藤',root:'#7656a7',fills:['#eee7f7','#e4f0ea','#f5ecd9','#f5e6eb'],lines:['#967ab9','#70a191','#c29b61','#bb8495']},
    forest:{name:'松间清晨',root:'#486f65',fills:['#e2eee8','#e4edf2','#f1ecd9','#eae7ef'],lines:['#779e8e','#7d9bab','#b3a169','#9c8fae']},
    ink:{name:'简约墨色',root:'#4b4b58',fills:['#ebeaf0','#e9e9ed','#f1eeea','#eeeaed'],lines:['#9692a3','#9293a0','#aaa197','#a79ba3']}
  };
  function wrapText(text,maxWidth,font) {
    measure.font=font;var result=[],line='';
    String(text).split('\n').forEach(function(part){
      if(!part){result.push('');return;}
      Array.from(part).forEach(function(ch){if(line&&measure.measureText(line+ch).width>maxWidth){result.push(line);line=ch;}else line+=ch;});
      result.push(line);line='';
    });
    return result.length?result:[''];
  }
  function computeLayout(s) {
    var nodes=[],edges=[],theme=themes[s.theme]||themes.wisteria;
    function size(n,depth){var font=(depth===0?'500 19px ':'500 15px ')+'Arial,"PingFang SC",sans-serif';var lines=wrapText(n.text,depth===0?174:150,font);measure.font=font;var w=Math.max(depth===0?140:depth===1?120:80,Math.min(210,Math.max.apply(null,lines.map(function(l){return measure.measureText(l).width;}))+30));return {w:w,h:Math.max(depth===0?58:42,lines.length*(depth===0?24:20)+22),lines:lines};}
    function make(n,depth,x,y,branch,parent,side){var m=Object.assign({node:n,depth:depth,x:x,y:y,branch:branch,parent:parent,side:side},size(n,depth));nodes.push(m);if(parent)edges.push({from:parent,to:m});return m;}
    var root=make(s.root,0,0,0,0,null,'right');
    function leaves(n){if(n.collapsed||!n.children.length)return 1;return n.children.reduce(function(v,c){return v+leaves(c);},0);}
    if(s.layout==='down'){
      var index=0,total=s.root.children.reduce(function(v,n){return v+leaves(n);},0);
      function visitDown(n,depth,branch,parent){var kids=n.collapsed?[]:n.children;var m=make(n,depth,0,depth*145,branch,parent,'down');if(kids.length){var cs=kids.map(function(c){return visitDown(c,depth+1,branch,m);});m.x=(cs[0].x+cs[cs.length-1].x)/2;}else m.x=(index++-(total-1)/2)*180;return m;}
      if(!s.root.collapsedDown)s.root.children.forEach(function(n,i){visitDown(n,1,i,root);});
    } else {
      ['right','left'].forEach(function(side){
        var kids=s.root[rootCollapseKey(side)]?[]:s.root.children.filter(function(n,i){return rootChildSide(s.layout,n,i,s.root.children.length)===side;});
        var total=kids.reduce(function(v,n){return v+leaves(n);},0),index=0;
        function visit(n,depth,branch,parent){var children=n.collapsed?[]:n.children,m=make(n,depth,(side==='right'?1:-1)*depth*235,0,branch,parent,side);if(children.length){var cs=children.map(function(c){return visit(c,depth+1,branch,m);});m.y=(cs[0].y+cs[cs.length-1].y)/2;}else m.y=(index++-(total-1)/2)*86;return m;}
        kids.forEach(function(n){visit(n,1,s.root.children.indexOf(n),root);});
      });
    }
    var minX=Math.min.apply(null,nodes.map(function(n){return n.x-n.w/2;})),maxX=Math.max.apply(null,nodes.map(function(n){return n.x+n.w/2;})),minY=Math.min.apply(null,nodes.map(function(n){return n.y-n.h/2;})),maxY=Math.max.apply(null,nodes.map(function(n){return n.y+n.h/2;}));
    return {nodes:nodes,edges:edges,theme:theme,bounds:{minX:minX,maxX:maxX,minY:minY,maxY:maxY,width:maxX-minX,height:maxY-minY}};
  }
  function edgePath(e,layout) {
    var a=e.from,b=e.to;
    if(layout==='down'){var y1=a.y+a.h/2,y2=b.y-b.h/2,mid=(y1+y2)/2;return 'M '+a.x+' '+y1+' C '+a.x+' '+mid+' '+b.x+' '+mid+' '+b.x+' '+y2;}
    var side=b.side==='left'?-1:1,x1=a.x+side*a.w/2,x2=b.x-side*b.w/2,mid=(x1+x2)/2;return 'M '+x1+' '+a.y+' C '+mid+' '+a.y+' '+mid+' '+b.y+' '+x2+' '+b.y;
  }
  function collapseControlMarkup(id, cx, cy, collapsed, branch, color) {
    return '<g class="node-collapse" data-act="collapse-node" data-id="'+esc(id)+'"'+(branch?' data-branch="'+branch+'"':'')+' transform="translate('+cx+','+cy+')"><circle r="9" fill="'+color+'"/><path d="M-4 0H4'+(collapsed?'M0-4V4':'')+'" stroke="#fff" stroke-width="1.3"/></g>';
  }
  function graphMarkup(layout,interactive) {
    var s=currentSheet(),theme=layout.theme;
    var out=layout.edges.map(function(e){return '<path class="mm-edge" d="'+edgePath(e,s?s.layout:'both')+'" stroke="'+theme.lines[e.to.branch%4]+'" fill="none" stroke-width="2" stroke-linecap="round"/>';}).join('');
    layout.nodes.forEach(function(n){
      var root=n.depth===0,leaf=n.depth>1,selected=interactive&&state.selected===n.node.id,fill=n.node.fill||(root?theme.root:leaf?'transparent':theme.fills[n.branch%4]);
      out+='<g class="mm-node '+(root?'node-root ':leaf?'node-leaf ':'')+(selected?'is-selected':'')+'" transform="translate('+n.x+','+n.y+')" '+(interactive?'data-act="select-node" data-id="'+esc(n.node.id)+'" role="button" aria-label="'+esc(n.node.text)+'"':'')+'>';
      if(selected)out+='<rect class="selection-ring" x="'+(-n.w/2-5)+'" y="'+(-n.h/2-5)+'" width="'+(n.w+10)+'" height="'+(n.h+10)+'" rx="15"/>';
      out+='<rect class="node-shape" x="'+(-n.w/2)+'" y="'+(-n.h/2)+'" width="'+n.w+'" height="'+n.h+'" rx="'+(root?15:11)+'" fill="'+fill+'"/>';
      if(leaf)out+='<path d="M '+(-n.w/2+8)+' '+(n.h/2-3)+' H '+(n.w/2-8)+'" stroke="'+theme.lines[n.branch%4]+'" stroke-width="1.5"/>';
      out+='<text class="node-title" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif" font-size="'+(root?19:15)+'" font-weight="'+(leaf?400:500)+'" fill="'+(root?'#ffffff':'#302b38')+'">';
      n.lines.forEach(function(line,i){out+='<tspan x="0" y="'+((i-(n.lines.length-1)/2)*(root?24:20)+5)+'">'+esc(line)+'</tspan>';});out+='</text>';
      if(n.node.note)out+='<g class="node-note" transform="translate('+(n.w/2-13)+','+(-n.h/2+10)+')"><path d="M-3-3h6v7h-6Z" fill="none" stroke="#756e7d" stroke-width="1"/></g>';
      if(interactive&&n.node.children.length){
        if(root){
          var branches=s.layout==='down'?['down']:['left','right'];
          branches.forEach(function(branch){
            var hasBranch=n.node.children.some(function(child,index){return rootChildSide(s.layout,child,index,n.node.children.length)===branch;});
            if(!hasBranch)return;
            var cx=branch==='left'?-n.w/2-11:branch==='down'?0:n.w/2+11,cy=branch==='down'?n.h/2+10:0;
            out+=collapseControlMarkup(n.node.id,cx,cy,!!n.node[rootCollapseKey(branch)],branch,theme.root);
          });
        } else {
          var cx=n.side==='left'?-n.w/2-11:n.w/2+11,cy=n.side==='down'?n.h/2+10:0;if(n.side==='down')cx=0;
          out+=collapseControlMarkup(n.node.id,cx,cy,!!n.node.collapsed,null,theme.root);
        }
      }
      out+='</g>';
    });
    return out;
  }
  function renderCanvas() {
    var s=currentSheet(),v=$('viewport'),svg=$('map-svg'),w=v.clientWidth,h=v.clientHeight;
    var focusedControl=v.contains(document.activeElement)&&!document.activeElement.closest('.mm-node')?focusKey(document.activeElement):null;
    svg.setAttribute('viewBox','0 0 '+Math.max(1,w)+' '+Math.max(1,h));
    var old=$('empty-canvas');if(old)old.remove();
    if(!s){svg.innerHTML='';$('contextbar').hidden=true;$('canvas-commands').hidden=true;$('view-controls').hidden=true;$('canvas-status').textContent='';v.insertAdjacentHTML('beforeend','<div id="empty-canvas" class="empty-canvas"><div class="empty-card"><div class="empty-icon">'+icon('map',34)+'</div><h1>让新的想法展开</h1><p>从工作目录打开思维导图，<br>或创建一份新的导图。</p><div class="empty-actions">'+btn('new','新建思维导图','plus','button primary')+btn('open','打开文件','folder','button')+'</div></div></div>');return;}
    $('canvas-commands').hidden=false;$('view-controls').hidden=false;
    layoutCache=computeLayout(s);
    if(state.autoFit){state.zoom=Math.min(1,Math.max(.25,Math.min((w-110)/Math.max(1,layoutCache.bounds.width),(h-170)/Math.max(1,layoutCache.bounds.height))));state.pan.x=-(layoutCache.bounds.minX+layoutCache.bounds.maxX)/2*state.zoom;state.pan.y=-(layoutCache.bounds.minY+layoutCache.bounds.maxY)/2*state.zoom+12;}
    svg.innerHTML='<g transform="translate('+(w/2+state.pan.x)+','+(h/2+state.pan.y)+') scale('+state.zoom+')">'+graphMarkup(layoutCache,true)+'</g>';
    $('canvas-commands').innerHTML=isExternal(current())?'<span class="preview-label">'+icon('lock',14)+'只读预览</span>'+btn('compat-report','兼容说明',null,'text-button')+'<span class="divider"></span>'+btn('edit-copy','创建可编辑副本',null,'text-button'):ibtn('undo','撤销','undo',current().undo.length?'':'disabled')+ibtn('redo','重做','redo',current().redo.length?'':'disabled')+'<span class="divider"></span>'+ibtn('theme','主题','palette')+ibtn('layout-menu','选择导图结构','tree','aria-haspopup="menu" aria-expanded="'+(state.menu==='layout')+'"');
    $('view-controls').innerHTML='<div class="view-control-group">'+ibtn('zoom-out','缩小','minus')+'<span class="zoom-value">'+Math.round(state.zoom*100)+'%</span>'+ibtn('zoom-in','放大','plus')+'<span class="divider"></span>'+btn('fit','适应画布','fit','text-button')+btn('reset-view','<span class="reset-label">重置视图</span>','target','text-button','aria-label="重置视图" title="恢复缩放与位置，不修改内容"')+'</div>';
    $('canvas-status').textContent=state.loadingId?'正在打开文件…':'';
    renderContext();
    if(focusedControl&&!state.overlay&&!state.editId)restoreFocus(focusedControl);
  }
  function renderContext() {
    var bar=$('contextbar'),n=layoutCache&&layoutCache.nodes.find(function(n){return n.node.id===state.selected;});
    bar.hidden=!n||!!state.overlay||!!state.editId;
    if(bar.hidden)return;
    bar.innerHTML=btn('add-child','子主题','child','text-button')+btn('add-sibling','同级','sibling','text-button',n.depth===0?'disabled':'')+'<span class="divider"></span>'+btn('node-style','样式','palette','text-button')+btn('note','备注','note','text-button');
    var v=$('viewport'),bw=bar.offsetWidth,x=v.clientWidth/2+state.pan.x+n.x*state.zoom-bw/2,y=v.clientHeight/2+state.pan.y+(n.y-n.h/2)*state.zoom-48;
    if(y<74)y=v.clientHeight/2+state.pan.y+(n.y+n.h/2)*state.zoom+15;
    bar.style.left=Math.max(12,Math.min(v.clientWidth-bw-12,x))+'px';bar.style.top=Math.max(75,Math.min(v.clientHeight-100,y))+'px';
  }
  function renderSheetbar() {
    var d=current(),s=currentSheet();
    $('sheetbar').innerHTML=d?d.sheets.map(function(sh){
      if(state.sheetEditId===sh.id)return '<input id="sheet-name-input" class="sheet-name-input" data-id="'+esc(sh.id)+'" value="'+esc(sh.name)+'" maxlength="80" aria-label="画布名称">';
      return sheetTabMarkup(sh,s.id);
    }).join('')+ibtn('add-sheet','添加画布','plus')+'<span class="sheet-status">'+allNodes(s.root).length+' 个主题 · '+d.sheets.length+' 张画布</span>':'<span class="sheet-status">未打开文件</span>';
  }
  function sheetTabMarkup(sh,activeId) {return '<button class="sheet-tab '+(activeId===sh.id?'active':'')+'" data-act="sheet" data-id="'+esc(sh.id)+'" aria-pressed="'+(activeId===sh.id)+'" title="双击重命名" aria-label="画布 '+esc(sh.name)+'，双击重命名">'+esc(sh.name)+'</button>';}
  function focusSheetName() { var input=$('sheet-name-input');if(input){input.focus({preventScroll:true});input.select();} }
  function beginSheetRename(id) {
    var d=current(),sh=d&&d.sheets.find(function(item){return item.id===id;});
    if(!sh||state.overlay||state.deleting)return;
    if(!ensureEditable({act:'rename-sheet',id:id}))return;
    if(!finishEdit(false))return;
    state.sheetEditId=id;renderSheetbar();requestAnimationFrame(focusSheetName);notify('编辑画布名称');
  }
  function finishSheetRename(cancel) {
    var id=state.sheetEditId,d=current(),input=$('sheet-name-input'),name=input?input.value.trim():'',sh=d&&d.sheets.find(function(item){return item.id===id;});
    if(!id)return true;
    if(!cancel&&!name){toast('画布名称不能为空');requestAnimationFrame(focusSheetName);return false;}
    state.sheetEditId=null;
    if(!cancel&&sh&&name!==sh.name)markChanged(function(){sh.name=name;},'重命名画布',false,true,true);
    else notify(cancel?'取消重命名画布':'保持画布名称');
    if(input&&sh)input.outerHTML=sheetTabMarkup(sh,d.activeSheetId);
    return true;
  }
  function inspectorMarkup(kind) {
    var s=currentSheet(),n=state.selected&&findNode(state.selected);
    if(!s)return '';
    if(kind==='theme')return '<div class="panel-title">主题'+ibtn('close-inspector','关闭主题面板','close')+'</div><div class="field-label" style="margin-bottom:14px">当前画布</div>'+Object.keys(themes).map(function(key){var t=themes[key];return '<button class="theme-card '+(s.theme===key?'selected':'')+'" data-act="set-theme" data-id="'+key+'" aria-pressed="'+(s.theme===key)+'"><i class="theme-colors">'+t.fills.map(function(c){return '<i style="background:'+c+'"></i>';}).join('')+'</i><span>'+t.name+'</span>'+(s.theme===key?icon('check',14):'')+'</button>';}).join('');
    if(!n)return '';
    var t=themes[s.theme];
    return '<div class="panel-title">节点样式'+ibtn('close-inspector','关闭属性面板','close')+'</div><div class="field"><label class="field-label" for="node-title">主题文字</label><textarea id="node-title" maxlength="500">'+esc(n.text)+'</textarea></div><div class="field"><span class="field-label">填充</span><div class="swatches">'+[null].concat(t.fills).map(function(c,i){return '<button class="swatch '+(n.fill===c?'selected':'')+'" style="background:'+(c||t.root)+'" data-act="node-fill" data-id="'+(c||'default')+'" aria-label="'+(i?'填充颜色 '+i:'跟随主题')+'" aria-pressed="'+(n.fill===c)+'"></button>';}).join('')+'</div></div><div class="field"><label class="field-label" for="node-note">备注</label><textarea id="node-note" placeholder="添加备注…">'+esc(n.note)+'</textarea></div>'+btn('reset-node-style','恢复主题样式',null,'text-button');
  }
  function renderInspector() { var panel=$('inspector'),key=panel.contains(document.activeElement)?focusKey(document.activeElement):null;panel.hidden=!state.inspector;panel.innerHTML=state.inspector?inspectorMarkup(state.inspector):'';if(key&&state.inspector)restoreFocus(key); }
  function renderAll(event) { renderHeader();renderSidebar();renderInspector();renderSheetbar();renderCanvas();renderMenu();renderOverlay();app.classList.toggle('is-locked',!!state.overlay||state.deleting);notify(event); }
  function markChanged(mutator,event,allowModal,preserveSidebar,preserveSheetbar) {
    if(!current()||isExternal(current())||(state.overlay&&!allowModal)||state.deleting)return;
    var d=current();d.undo.push(docData(d));if(d.undo.length>40)d.undo.shift();d.redo=[];mutator();d.revision++;state.error='';renderHeader();
    if(preserveSidebar){
      var row=$('file-sidebar').querySelector('.file-row[data-id="'+CSS.escape(d.id)+'"]');
      if(row&&!row.querySelector('.dirty-dot'))row.querySelector('.file-row-name').insertAdjacentHTML('afterend','<i class="dirty-dot"></i>');
      $('file-sidebar').querySelectorAll('.outline-row').forEach(function(el){var node=findNode(el.querySelector('.outline-select')&&el.querySelector('.outline-select').dataset.id),label=el.querySelector('.outline-label');if(node&&label)label.textContent=node.text;});
    }else renderSidebar();
    if(!preserveSheetbar)renderSheetbar();renderCanvas();notify(event||'修改内容');
  }
  function historyChange(direction) {
    if(!current()||state.overlay)return;
    if(!ensureEditable({act:direction}))return;
    var d=current(),from=direction==='undo'?d.undo:d.redo,to=direction==='undo'?d.redo:d.undo;if(!from.length)return;
    to.push(docData(d));Object.assign(d,from.pop());d.revision++;state.selected=null;state.inspector=null;renderAll(direction==='undo'?'撤销':'重做');
  }
  function openInspector(kind) { inspectorTriggerKey=lastActionKey||focusKey(document.activeElement);closeMenu();if(!current())return;if(app.clientWidth<1050){state.inspector=null;state.drawerKind=kind;showOverlay('style');}else{state.inspector=kind;renderInspector();requestAnimationFrame(function(){renderCanvas();var field=$('inspector').querySelector(kind==='node'?'#node-title':'.theme-card');if(field)field.focus({preventScroll:true});});notify('打开'+(kind==='theme'?'主题':'属性')+'面板');} }
  function closeInspector() { var key=state.overlay==='style'?lastTriggerKey:inspectorTriggerKey;state.inspector=null;if(state.overlay==='style')hideOverlay();renderInspector();requestAnimationFrame(function(){renderCanvas();restoreFocus(key);});notify('关闭属性面板'); }
  function selectNode(id) {
    if(state.overlay)return;state.selected=id;
    $('map-svg').querySelectorAll('.selection-ring').forEach(function(el){el.remove();});
    $('map-svg').querySelectorAll('.mm-node').forEach(function(el){el.classList.toggle('is-selected',el.dataset.id===id);});
    var node=layoutCache&&layoutCache.nodes.find(function(n){return n.node.id===id;}),g=$('map-svg').querySelector('.mm-node[data-id="'+CSS.escape(id)+'"]');
    if(node&&g)g.insertAdjacentHTML('afterbegin','<rect class="selection-ring" x="'+(-node.w/2-5)+'" y="'+(-node.h/2-5)+'" width="'+(node.w+10)+'" height="'+(node.h+10)+'" rx="15"/>');
    renderContext();if(state.inspector)renderInspector();renderSidebar();$('viewport').focus({preventScroll:true});notify('选中主题');
  }
  function beginEdit(id) {
    if(state.overlay)return;var n=findNode(id);if(!n)return;selectNode(id);
    if(!ensureEditable({act:'edit-node',id:id}))return;
    var el=$('map-svg').querySelector('[data-id="'+CSS.escape(id)+'"] .node-shape');if(!el)return;
    var r=el.getBoundingClientRect(),v=$('viewport').getBoundingClientRect(),input=$('inline-editor');state.editId=id;input.value=n.text;input.style.left=Math.max(8,r.left-v.left-8)+'px';input.style.top=Math.max(75,r.top-v.top-6)+'px';input.style.width=Math.max(150,r.width+16)+'px';input.style.height=Math.max(54,r.height+12)+'px';input.hidden=false;$('contextbar').hidden=true;input.focus();input.select();notify('编辑主题文字');
  }
  function finishEdit(cancel) {
    if(!state.editId)return true;if(state.composing)return false;
    var id=state.editId,value=$('inline-editor').value.trim(),n=findNode(id);state.editId=null;$('inline-editor').hidden=true;
    if(!cancel&&n&&value&&value!==n.text)markChanged(function(){n.text=value;},'修改主题文字',false,true);
    renderContext();return true;
  }
  function addNode(sibling) {
    if(!current()||!ensureEditable({act:sibling?'add-sibling':'add-child'}))return;var p=state.selected&&findNode(state.selected);if(!p)p=currentSheet().root;
    if(sibling){p=findParent(p.id);if(!p)return;}
    var n=tree('topic-'+(++uid),'新主题');if(p===currentSheet().root)n.side=p.children.length%2?'left':'right';
    markChanged(function(){p.collapsed=false;p.children.push(n);state.selected=n.id;},sibling?'添加同级主题':'添加子主题');beginEdit(n.id);
  }
  function removeNode() { if(!ensureEditable({act:'delete-node'}))return;var n=findNode(state.selected),p=n&&findParent(n.id);if(!p){toast('中心主题可通过“重置画布”重建');return;}markChanged(function(){p.children=p.children.filter(function(c){return c.id!==n.id;});state.selected=p.id;},'删除主题');if(state.inspector)renderInspector(); }
  function showOverlay(kind) {
    if(state.deleting)return;
    if(!finishEdit(false)||!finishSheetRename(false)){toast('请先完成输入');return;}
    lastTrigger=document.activeElement;lastTriggerKey=lastActionKey||focusKey(lastTrigger);state.menu=null;state.overlay=kind;state.error='';state.inspector=null;
    renderAll('打开'+kind);activateDialog();
  }
  function hideOverlay() {
    if(state.deleting)return;
    state.overlay=null;state.error='';state.guardSaving=false;state.pending=null;state.copyIntent=null;state.deferredDiscard=null;state.leaveCounter++;renderAll('关闭浮层');
    restoreFocus(lastTriggerKey,lastTrigger);
  }
  function activateDialog() { requestAnimationFrame(function(){var dialog=$('overlay-host').querySelector('[role="dialog"]');if(dialog){var first=dialog.querySelector('[autofocus]')||dialog.querySelector('input:not([type="radio"]):not([type="checkbox"]),select,textarea')||dialog.querySelector('button:not([disabled])');(first||dialog).focus({preventScroll:true});}}); }
  function closeMenu() { state.menu=null;state.menuFile=null;$('popover-host').innerHTML=''; }
  function openMenu(kind,anchor,fileId) { if(state.overlay||state.deleting)return;var was=state.menu===kind&&state.menuFile===fileId;closeMenu();if(was)return;menuTriggerKey=focusKey(anchor);state.menu=kind;state.menuFile=fileId||null;state.menuAnchor=anchor.getBoundingClientRect();renderMenu();notify('打开菜单');var first=$('popover-host').querySelector('button');if(first)first.focus({preventScroll:true}); }
  function menuItem(act,text,ico,shortcut,extra){return '<button class="menu-item '+(act==='request-delete'||act==='clear'?'danger':'')+'" data-act="'+act+'" role="menuitem" '+(extra||'')+'>'+icon(ico)+'<span>'+text+'</span>'+(shortcut?'<span class="shortcut">'+shortcut+'</span>':'')+'</button>';}
  function renderMenu() {
    if(!state.menu){$('popover-host').innerHTML='';return;}
    var html='';
    if(state.menu==='file')html=menuItem('new','新建思维导图','plus','⌘ N')+menuItem('open','打开文件','folder','⌘ O')+'<div class="menu-separator"></div>'+menuItem('close-file','关闭当前文件','close','')+menuItem('reset-view','重置视图（缩放与位置）','target','⌘ 0')+menuItem('clear','重置画布','trash','')+'<div class="menu-separator"></div>'+menuItem('shortcuts','快捷键','keyboard','');
    if(state.menu==='options'){
      var menuDocument=state.docs.find(function(file){return file.id===state.menuFile;});
      html=menuItem('open-file','打开','file','', 'data-id="'+esc(state.menuFile)+'"')+menuItem('duplicate-file',isExternal(menuDocument)?'创建可编辑副本':'另存副本','save','', 'data-id="'+esc(state.menuFile)+'"')+'<div class="menu-separator"></div>'+menuItem('request-delete','移到回收站','trash','', 'data-id="'+esc(state.menuFile)+'"');
    }
    if(state.menu==='layout')html=['both','right','down'].map(function(key){var labels={both:'左右思维导图',right:'向右逻辑图',down:'向下组织图'};return menuItem('set-layout',labels[key],currentSheet().layout===key?'check':'tree','', 'data-id="'+key+'"');}).join('');
    var r=state.menuAnchor,ar=app.getBoundingClientRect(),left=Math.min(app.clientWidth-220,Math.max(8,r.left-ar.left)),top=r.bottom-ar.top+6;
    $('popover-host').innerHTML='<div class="popover" role="menu" style="left:'+left+'px;top:'+top+'px">'+html+'</div>';
  }
  function dialog(title,body,footer,kind,wide) {
    return '<div class="overlay '+(kind==='directory'||kind==='style'?'drawer-overlay':'')+'" data-backdrop="true"><section class="dialog '+(wide?'wide-dialog ':'')+(kind==='directory'?'drawer ':kind==='style'?'drawer right-drawer ':'')+'" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><div class="dialog-header"><div id="dialog-title" class="dialog-title">'+title+'</div>'+ibtn('dismiss','关闭对话框','close',state.deleting||state.guardSaving?'disabled':'')+'</div><div class="dialog-content">'+(state.error?'<div class="dialog-note" role="alert" style="color:var(--mm-danger)">'+esc(state.error)+'</div>':'')+body+'</div>'+(footer?'<div class="dialog-footer">'+footer+'</div>':'')+'</section></div>';
  }
  function renderOverlay() {
    var k=state.overlay,host=$('overlay-host'),d=current(),cancel=btn('dismiss','取消',null,'button',state.deleting||state.guardSaving?'disabled':'');
    if(!k){host.innerHTML='';app.querySelector('.workspace').inert=false;$('app-header').inert=false;return;}
    app.querySelector('.workspace').inert=true;
    $('app-header').inert=true;
    var h='',b='',f='';
    if(k==='directory'){
      b='<p class="drawer-description">选择一个工作目录，管理其中的思维导图。</p>'+['我的导图','项目研究','空白工作目录'].map(function(n){return '<button class="folder-choice '+(state.folderChoice===n?'selected':'')+'" data-act="choose-folder" data-id="'+esc(n)+'">'+icon('folder',21)+'<span>'+n+'</span>'+(state.folderChoice===n?icon('check',16):'')+'</button>';}).join('');
      h=dialog('选择工作目录',b,cancel+btn('use-folder','使用此目录',null,'button primary'),k);
    }
    if(k==='files'){
      b='<div class="folder-row">'+icon('folder',18)+'<strong>'+esc(state.folderName)+'</strong>'+ibtn('directory','更换工作目录','more')+'</div>'+state.docs.map(function(file){return '<button class="open-choice" data-act="open-choice" data-id="'+esc(file.id)+'">'+icon('file',20)+'<span>'+esc(file.name)+'</span>'+icon('right',14)+'</button>';}).join('');
      h=dialog('文件目录',b,btn('dismiss','关闭',null,'button')+btn('new','新建思维导图','plus','button primary'),'directory');
    }
    if(k==='new'){
      b='<div class="field"><label class="field-label" for="new-name">文件名称</label><input id="new-name" maxlength="80" value="未命名导图" autofocus></div><div class="field"><label class="field-label" for="new-layout">结构</label><select id="new-layout"><option value="both">左右思维导图</option><option value="right">向右逻辑图</option><option value="down">向下组织图</option></select></div>';
      h=dialog('新建思维导图',b,cancel+btn('create-file','创建',null,'button primary'),k);
    }
    if(k==='unsaved'){
      var deleting=state.pending&&state.pending.kind==='delete',next=state.pending&&state.pending.kind==='open'?state.docs.find(function(f){return f.id===state.pending.id;}):null;
      b='<p>要保存对 <strong>'+esc(d?d.name:'当前文件')+'</strong> 的更改吗？</p><div class="dialog-note">'+(deleting?'保存完整副本后再删除原文件，或明确放弃当前更改。':next?'保存完成后将打开“'+esc(next.name)+'”。':'保存完成后继续当前操作。')+'</div>'+(state.guardSaving?'<div class="locked-message"><i class="busy-spinner"></i> 正在保存，请稍候…</div>':'');
      f=cancel+btn('discard-leave',deleting?'放弃更改并删除':'放弃更改',null,'button text-danger',state.guardSaving?'disabled':'')+btn('save-leave',deleting?'另存副本后删除':'保存并继续',null,'button primary',state.guardSaving?'disabled':'');h=dialog('未保存的更改',b,f,k,true);
    }
    if(k==='delete'){
      var target=state.docs.find(function(f){return f.id===state.deleteId;});
      b='<p>将 <strong>'+esc(target?target.name:'此文件')+'</strong> 移到回收站？</p><p class="small muted">如需恢复，请从系统回收站找回。</p>'+(state.deleting?'<div class="locked-message"><i class="busy-spinner"></i> 正在移到回收站…</div>':'');
      h=dialog('删除文件',b,cancel+btn('confirm-delete',state.deleting?'正在删除…':'移到回收站','trash','button danger',state.deleting?'disabled':''),k);
    }
    if(k==='compat'){
      b='<p><strong>'+esc(d?d.name:'外部导图')+'</strong> 已直接以只读方式打开；切换文件不再弹出此说明。</p><ul class="compat-list"><li><span>'+icon('check',16)+'</span><div>主题层级与文字可预览<small>可切换画布、缩放和查看大纲。</small></div></li><li><span>'+icon('alert',16)+'</span><div>高级对象按实际解析结果报告<small>编辑前会创建新的 .gxp 工作文件，仅转换已支持内容。</small></div></li></ul>';
      h=dialog('预览兼容说明',b,btn('dismiss','知道了',null,'button primary'),k,true);
    }
    if(k==='export'){
      var selected=!!state.selected;
      b='<div class="field"><label class="field-label" for="export-format">格式</label><select id="export-format"><option value="svg" '+(state.exportFormat==='svg'?'selected':'')+'>SVG · 矢量图</option><option value="png" '+(state.exportFormat==='png'?'selected':'')+'>PNG · 图片</option></select></div><div class="field"><label class="field-label" for="export-range">范围</label><select id="export-range"><option value="current" '+(state.exportRange==='current'?'selected':'')+'>当前画布</option><option value="all" '+(state.exportRange==='all'?'selected':'')+'>全部画布 · 每张一个文件</option><option value="selected" '+(state.exportRange==='selected'?'selected':'')+' '+(!selected?'disabled':'')+'>选中主题及子树</option></select></div><label class="checkbox-row"><input type="checkbox" id="export-transparent" '+(state.exportTransparent?'checked':'')+'>透明背景</label>'+(state.exportFormat==='png'?'<div class="field" style="margin-top:12px"><label class="field-label" for="export-scale">分辨率</label><select id="export-scale"><option value="1" '+(state.exportScale==='1'?'selected':'')+'>1×</option><option value="2" '+(state.exportScale==='2'?'selected':'')+'>2×</option></select></div>':'')+'<p class="small muted export-destination-note">导出时将打开系统“另存为”，由你选择电脑上的目标路径。</p><div id="export-results" class="export-results">'+state.exportResults.map(function(r){return r.saved?'<div class="export-download is-saved"><span>'+esc(r.name)+'</span><small>已保存到所选位置</small>'+icon('check',14)+'</div>':'<a class="export-download" href="'+r.url+'" download="'+esc(r.name)+'"><span>'+esc(r.name)+'</span><small>浏览器下载备用</small>'+icon('export',14)+'</a>';}).join('')+'</div>';
      h=dialog('导出思维导图',b,cancel+btn('generate-export','导出',null,'button primary'),k);
    }
    if(k==='style'){b=inspectorMarkup(state.drawerKind).replace(/^<div class="panel-title">[\s\S]*?<\/div>/,'');h=dialog(state.drawerKind==='theme'?'主题':'节点样式',b,btn('dismiss','完成',null,'button primary'),k);}
    if(k==='note'){
      var note=findNode(state.selected);h=dialog('主题备注','<div class="field"><label class="field-label" for="note-text">'+esc(note?note.text:'主题')+'</label><textarea id="note-text" rows="6" placeholder="添加备注…">'+esc(note?note.note:'')+'</textarea></div>',cancel+btn('save-note','完成',null,'button primary'),k);
    }
    if(k==='clear')h=dialog('重置画布','<p>移除所有分支并保留中心主题？</p><p class="small muted">仅重置内容，不改变缩放或位置；此操作可撤销，也不会删除磁盘文件。</p>',cancel+btn('confirm-clear','重置画布',null,'button danger'),k);
    if(k==='editable-copy')h=dialog('创建可编辑副本','<p><strong>'+esc(d?d.name:'外部导图')+'</strong> 当前为只读预览。</p><p class="small muted">将当前可支持的内容保存为新的 .gxp 工作文件后继续编辑，原文件保持不变。</p>',cancel+btn('confirm-edit-copy','创建副本并继续',null,'button primary'),k);
    if(k==='shortcuts')h=dialog('快捷键','<div class="compat-list"><div class="menu-item"><span>新建子主题</span><span class="shortcut">Tab</span></div><div class="menu-item"><span>新建同级主题</span><span class="shortcut">Enter</span></div><div class="menu-item"><span>编辑文字</span><span class="shortcut">双击</span></div><div class="menu-item"><span>保存</span><span class="shortcut">⌘ / Ctrl S</span></div><div class="menu-item"><span>撤销 / 重做</span><span class="shortcut">⌘ / Ctrl Z / ⇧ Z</span></div><div class="menu-item"><span>重置视图</span><span class="shortcut">⌘ / Ctrl 0</span></div><div class="menu-item"><span>关闭浮层 / 取消选择</span><span class="shortcut">Esc</span></div></div>',btn('dismiss','知道了',null,'button primary'),k);
    host.innerHTML=h;
    if(document.activeElement===document.body||!app.contains(document.activeElement))activateDialog();
  }
  function requestLeave(intent) {
    if(state.deleting||state.guardSaving)return;
    closeMenu();if(!finishEdit(false)||!finishSheetRename(false)){toast('请先完成输入');return;}
    state.openCounter++;state.loadingId=null;state.deferredDiscard=null;
    intent.sourceId=state.currentId;intent.token=++state.leaveCounter;
    if(isDirty(current())){state.pending=intent;showOverlay('unsaved');return;}
    executeIntent(intent);
  }
  function executeIntent(intent) {
    state.pending=null;state.overlay=null;state.error='';
    state.deferredDiscard=intent.discardRevision==null?null:{sourceId:intent.sourceId,revision:intent.discardRevision};
    if(intent.kind==='open')return prepareOpen(intent.id);
    if(intent.kind==='open-external')return loadExternalFile(intent.document);
    if(intent.kind==='close'){if(!commitDeferredDiscard())return;state.currentId=null;state.selected=null;state.inspector=null;state.openCounter++;renderAll('关闭当前文件');return;}
    if(intent.kind==='new'){showOverlay('new');return;}
    if(intent.kind==='directory'){state.folderChoice=state.folderName;showOverlay('directory');return;}
    if(intent.kind==='delete'){state.deleteId=intent.id;state.deleteProtectedRevision=current()&&current().revision;showOverlay('delete');return;}
  }
  function commitDeferredDiscard() {
    var record=state.deferredDiscard;if(!record)return true;
    var d=current();
    if(!d||d.id!==record.sourceId||d.revision!==record.revision){state.deferredDiscard=null;toast('内容有新的更改，请重新执行操作');renderAll('阻止过期放弃');return false;}
    Object.assign(d,clone(d.baseline));d.revision=d.savedRevision;d.undo=[];d.redo=[];state.deferredDiscard=null;return true;
  }
  function saveDoc() {
    var d=current();if(!d)return Promise.resolve(false);if(state.saving)return state.savePromise;
    if(isExternal(d)){ensureEditable(null);return Promise.resolve(false);}
    if(!finishEdit(false)||!finishSheetRename(false))return Promise.resolve(false);
    var snapshot=docData(d),rev=d.revision,id=d.id,run=state.epoch;
    state.saving={id:id,revision:rev};renderHeader();notify('开始保存');
    state.savePromise=new Promise(function(resolve){setTimeout(function(){
      if(state.epoch!==run){resolve(false);return;}
      var fail=state.fail.save;state.fail.save=false;state.saving=null;
      if(fail){state.error='保存失败，当前内容仍保留，请重试。';renderHeader();if(state.overlay)renderOverlay();toast('保存失败，未保存的内容仍保留');notify('保存失败');resolve(false);return;}
      d.baseline=snapshot;d.savedRevision=rev;renderHeader();renderSidebar();notify('保存完成');resolve(true);
    },650);});
    return state.savePromise;
  }
  async function saveAndLeave() {
    var pending=state.pending,d=current();if(!pending||!d||state.guardSaving)return;
    var token=pending.token,run=state.epoch;state.guardSaving=true;state.error='';renderAll('保存后继续');
    if(state.saving){var finished=await state.savePromise;if(!finished){state.guardSaving=false;renderOverlay();return;}}
    if(state.epoch!==run||!state.pending||state.pending.token!==token)return;
    if(pending.kind==='delete'){
      if(state.fail.save){state.fail.save=false;state.guardSaving=false;state.error='副本保存失败，原文件未删除。';renderOverlay();notify('副本保存失败');return;}
      await new Promise(function(resolve){setTimeout(resolve,450);});
      if(state.epoch!==run||!state.pending||state.pending.token!==token)return;
      var copy=copyDoc(d);state.docs.push(copy);state.copySavedRevision=d.revision;state.guardSaving=false;executeIntent(pending);toast('已保留完整副本');return;
    }
    var ok=await saveDoc();state.guardSaving=false;
    if(state.epoch!==run||!state.pending||state.pending.token!==token)return;
    if(!ok){renderOverlay();return;}
    if(current()!==d||d.revision!==d.savedRevision){state.error='还有新的更改，请保存最新内容后继续。';renderAll('继续保护最新修订');return;}
    executeIntent(pending);
  }
  async function discardAndLeave() {
    var pending=state.pending,d=current();if(!pending||state.guardSaving)return;
    if(d)pending.discardRevision=d.revision;
    if(state.saving){var run=state.epoch,token=pending.token;state.guardSaving=true;renderOverlay();await state.savePromise;state.guardSaving=false;if(state.epoch!==run||!state.pending||state.pending.token!==token)return;}
    executeIntent(pending);
  }
  function copyDoc(d) {
    var data=docData(d),name=d.name.replace(/\.[^.]+$/,'')+'-副本.'+NATIVE_EXTENSION;
    var cp=makeDoc('copy-'+(++uid),name,'native',clone(data.sheets));cp.activeSheetId=data.activeSheetId;cp.sourceName=isExternal(d)?d.name:d.sourceName||null;cp.baseline=docData(cp);return cp;
  }
  function createEditableCopy() {
    var source=current();if(!source||!isExternal(source)||state.overlay!=='editable-copy')return;
    var intent=state.copyIntent,copy=copyDoc(source);
    copy.revision=1;copy.imported=true;state.docs.push(copy);state.currentId=copy.id;
    state.overlay=null;state.copyIntent=null;state.error='';state.inspector=null;state.autoFit=true;
    renderAll('创建可编辑副本');
    if(intent){var target=document.createElement('button');target.dataset.act=intent.act;if(intent.id)target.dataset.id=intent.id;action(intent.act,target);}
    else $('viewport').focus({preventScroll:true});
  }
  function prepareOpen(id) {
    var target=state.docs.find(function(d){return d.id===id;});if(!target)return;if(target.id===state.currentId){renderAll('当前文件已打开');return;}
    loadFile(target);
  }
  function loadFile(target) {
    var token=++state.openCounter,run=state.epoch;state.overlay=null;state.loadingId=target.id;renderAll('开始打开文件');
    setTimeout(function(){
      if(run!==state.epoch||token!==state.openCounter)return;
      state.loadingId=null;if(state.fail.open){state.fail.open=false;state.deferredDiscard=null;toast('打开失败，当前画布未改变');renderAll('打开失败');return;}
      if(!commitDeferredDiscard())return;
      state.currentId=target.id;target.undo=[];target.redo=[];state.selected=null;state.inspector=null;state.pan={x:0,y:0};state.autoFit=true;renderAll('打开 '+target.name);$('viewport').focus({preventScroll:true});
    },300);
  }
  function loadExternalFile(target) {
    var token=++state.openCounter,run=state.epoch;state.overlay=null;state.loadingId=target.id;renderAll('开始打开外部文件');
    setTimeout(function(){
      if(run!==state.epoch||token!==state.openCounter)return;
      state.loadingId=null;
      if(state.fail.open){state.fail.open=false;state.deferredDiscard=null;toast('打开失败，当前画布未改变');renderAll('打开失败');return;}
      if(!commitDeferredDiscard())return;
      state.docs.push(target);state.currentId=target.id;state.selected=null;state.inspector=null;state.pan={x:0,y:0};state.autoFit=true;
      renderAll('打开外部文件 '+target.name);$('viewport').focus({preventScroll:true});
    },300);
  }
  function externalPickResult(selection) {
    var item=selection&&(selection.file||(selection.files&&selection.files[0])||selection);
    if(!item||!item.name)return;
    var target=makeExternalPreviewDocument(item.name);
    if(!target){toast('仅支持 .gxp、.smm 或 .xmind 文件');notify('拒绝不支持的外部文件');return;}
    requestLeave({kind:'open-external',document:target});
  }
  function browserOpenFile() {
    return new Promise(function(resolve){
      var input=document.createElement('input');input.type='file';input.accept='.gxp,.smm,.xmind';input.style.position='fixed';input.style.left='-9999px';
      input.addEventListener('change',function(){var picked=input.files&&input.files[0];input.remove();resolve(picked||null);},{once:true});
      input.addEventListener('cancel',function(){input.remove();resolve(null);},{once:true});
      document.body.appendChild(input);input.click();
    });
  }
  async function openExternalFile() {
    closeMenu();
    try {
      var host=window.__guanXiangPuHostFiles;
      var selection=host&&typeof host.openExternalFile==='function'?await host.openExternalFile():await browserOpenFile();
      if(!selection||(selection&&selection.cancelled)){notify('取消选择外部文件');return;}
      externalPickResult(selection);
    } catch(err) { toast('无法打开外部文件，请重试');notify('打开外部文件失败'); }
  }
  function requestDelete(id) {
    closeMenu();if(id===state.currentId)requestLeave({kind:'delete',id:id});else{state.deleteId=id;showOverlay('delete');}
  }
  function confirmDelete() {
    if(state.deleting)return;var target=state.docs.find(function(d){return d.id===state.deleteId;});if(!target)return;
    if(target===current()&&isDirty(target)&&state.deleteProtectedRevision!==target.revision&&state.copySavedRevision!==target.revision){requestLeave({kind:'delete',id:target.id});return;}
    var run=state.epoch,id=target.id;state.deleting=true;state.error='';renderAll('删除请求已发出');
    setTimeout(function(){
      if(state.epoch!==run)return;
      state.deleting=false;
      if(state.fail.delete){state.fail.delete=false;state.error='删除失败，文件和当前内容仍保留。';renderAll('删除失败');activateDialog();return;}
      state.docs=state.docs.filter(function(d){return d.id!==id;});if(state.currentId===id){state.currentId=null;state.selected=null;state.inspector=null;}state.overlay=null;state.pending=null;state.deferredDiscard=null;state.deleteId=null;renderAll('文件已移到回收站');toast('文件已移到回收站');$('viewport').focus({preventScroll:true});
    },1800);
  }
  function safeName(name){return name.replace(/[\\/:*?"<>|]/g,'-').slice(0,100)||'思维导图';}
  function exportSvg(s,selected,transparent) {
    var copy=clone(s);if(selected){var sub=findNode(selected,s.root);if(sub)copy.root=clone(sub);}
    var layout=computeLayout(copy),b=layout.bounds,w=Math.ceil(b.width+100),h=Math.ceil(b.height+100),oldSheet=currentSheet(),oldLayout=oldSheet&&oldSheet.layout;
    if(oldSheet)oldSheet.layout=copy.layout;
    var markup=graphMarkup(layout,false);
    if(oldSheet)oldSheet.layout=oldLayout;
    return {text:'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="'+(b.minX-50)+' '+(b.minY-50)+' '+w+' '+h+'">'+(!transparent?'<rect x="'+(b.minX-50)+'" y="'+(b.minY-50)+'" width="'+w+'" height="'+h+'" fill="#faf8f4"/>':'')+markup+'</svg>',width:w,height:h};
  }
  function mimeForExport(format) { return format==='svg'?'image/svg+xml':'image/png'; }
  async function saveExportOutputs(outputs,format) {
    var host=window.__guanXiangPuHostFiles;
    if(host&&typeof host.saveExports==='function'){
      var packets=await Promise.all(outputs.map(async function(output){return {name:output.name,mime:mimeForExport(format),data:new Uint8Array(await output.blob.arrayBuffer())};}));
      var hostResult=await host.saveExports(packets);
      return {cancelled:!!(hostResult&&hostResult.cancelled),savedNames:(hostResult&&hostResult.savedNames)||[]};
    }
    if(typeof window.showSaveFilePicker==='function'){
      var savedNames=[];
      try {
        for(var i=0;i<outputs.length;i++){
          var output=outputs[i],handle=await window.showSaveFilePicker({suggestedName:output.name,types:[{description:format==='svg'?'SVG 图像':'PNG 图片',accept:{[mimeForExport(format)]:['.'+format]}}]});
          var writable=await handle.createWritable();await writable.write(output.blob);await writable.close();savedNames.push(output.name);
        }
        return {cancelled:false,savedNames:savedNames};
      } catch(err) {
        if(err&&err.name==='AbortError')return {cancelled:true,savedNames:savedNames};
        /* file:// and a number of embedded browsers do not expose a usable
           File System Access picker; use a visible download fallback only there. */
        if(err&&['SecurityError','NotAllowedError','TypeError'].includes(err.name))return {cancelled:false,savedNames:savedNames};
        throw err;
      }
    }
    return {cancelled:false,savedNames:[]};
  }
  async function generateExport() {
    var d=current();if(!d)return;var format=state.exportFormat,range=state.exportRange,selected=range==='selected'?state.selected:null,run=state.epoch;
    if(format!=='svg'&&format!=='png')throw new Error('不支持的导出格式');
    var sheets=range==='all'?d.sheets:[currentSheet()],results=[];
    for(var i=0;i<sheets.length;i++){
      var s=sheets[i],base=safeName(d.name.replace(/\.[^.]+$/,''))+(range==='all'?'-'+(i+1)+'-'+safeName(s.name):''),blob;
      var exported=exportSvg(s,selected,state.exportTransparent);blob=new Blob([exported.text],{type:'image/svg+xml;charset=utf-8'});
      if(format==='png'){
        var url=URL.createObjectURL(blob),image=new Image();
        await new Promise(function(resolve,reject){image.onload=resolve;image.onerror=reject;image.src=url;});
        var canvas=document.createElement('canvas'),scale=Number(state.exportScale);canvas.width=exported.width*scale;canvas.height=exported.height*scale;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
        blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/png');});
      }
      if(!blob)throw new Error('生成导出文件失败');
      if(run!==state.epoch)return;
      results.push({blob:blob,name:base+'.'+format});
    }
    if(run!==state.epoch||state.overlay!=='export')return;
    var saved=await saveExportOutputs(results,format);
    if(run!==state.epoch||state.overlay!=='export')return;
    var savedNames=saved.savedNames||[];
    state.exportResults=results.map(function(result){
      if(savedNames.includes(result.name))return {name:result.name,saved:true};
      var url=URL.createObjectURL(result.blob);exportingUrls.push(url);return {name:result.name,url:url,saved:false};
    });
    renderOverlay();notify('导出文件');
    if(saved.cancelled&&savedNames.length)toast('已保存 '+savedNames.length+' 个文件；其余文件未选择位置');
    else if(saved.cancelled)toast('已取消选择导出位置');
    else if(savedNames.length===results.length)toast('已保存 '+results.length+' 个文件');
    else toast('当前环境不支持系统另存为，可点击下载备用文件');
  }
  function createFile() {
    var name=$('new-name').value.trim()||'未命名导图',layout=$('new-layout').value;if(!commitDeferredDiscard())return;var d=makeDoc('new-'+(++uid),safeName(name.replace(/\.(smm|xmind|gxp|treasuremind)$/i,''))+'.'+NATIVE_EXTENSION,'native',[sheet('sheet-'+(++uid),name,tree('root-'+(++uid),name))]);d.sheets[0].layout=layout;d.revision=1;state.docs.push(d);state.currentId=d.id;state.overlay=null;state.selected=null;state.inspector=null;state.autoFit=true;renderAll('新建思维导图');
  }
  function addSheet() {
    var d=current();if(!d||!ensureEditable({act:'add-sheet'}))return;
    var sh=sheet('sheet-'+(++uid),'新画布',tree('root-'+(++uid),'中心主题'));markChanged(function(){d.sheets.push(sh);d.activeSheetId=sh.id;state.selected=null;state.sheetEditId=sh.id;},'新增画布');renderInspector();state.autoFit=true;renderCanvas();requestAnimationFrame(focusSheetName);
  }
  function action(act,target) {
    if(state.deleting)return;
    lastActionKey=target?focusKey(target):focusKey(document.activeElement);
    var id=target&&target.dataset.id;
    if(['add-child','add-sibling','node-style','theme','layout-menu','set-layout','set-theme','node-fill','reset-node-style','note','clear','confirm-clear','collapse-node'].includes(act)&&!ensureEditable({act:act,id:id}))return;
    if(act==='file-menu'){openMenu('file',target);return;}
    if(act==='file-options'){openMenu('options',target,id);return;}
    if(act==='layout-menu'){openMenu('layout',target);return;}
    if(act!=='select-node'&&act!=='collapse-node')closeMenu();
    switch(act){
      case 'show-files':state.sidebarMode='files';renderSidebar();notify('查看文件目录');break;
      case 'show-outline':state.sidebarMode='outline';renderSidebar();requestAnimationFrame(renderCanvas);notify('查看大纲');break;
      case 'refresh':renderSidebar();toast('目录已刷新');notify('刷新目录');break;
      case 'reauthorize':state.permission=true;renderSidebar();toast('目录已重新授权');notify('重新授权目录');break;
      case 'directory':requestLeave({kind:'directory'});break;
      case 'choose-folder':state.folderChoice=id;renderOverlay();break;
      case 'use-folder':if(!commitDeferredDiscard())break;state.folderName=state.folderChoice;state.permission=true;state.docs=state.folderName==='空白工作目录'?[]:samples();if(state.folderName==='项目研究')state.docs[0].name='研究计划.gxp';state.currentId=null;state.selected=null;state.inspector=null;state.openCounter++;hideOverlay();toast('已切换工作目录');notify('切换工作目录');break;
      case 'open':openExternalFile();break;
      case 'open-choice':state.overlay=null;requestLeave({kind:'open',id:id});break;
      case 'open-file':requestLeave({kind:'open',id:id});break;
      case 'new':requestLeave({kind:'new'});break;
      case 'create-file':createFile();break;
      case 'close-file':requestLeave({kind:'close'});break;
      case 'save':saveDoc().then(function(ok){if(ok)toast('已保存');});break;
      case 'save-leave':saveAndLeave();break;
      case 'discard-leave':discardAndLeave();break;
      case 'request-delete':requestDelete(id);break;
      case 'confirm-delete':confirmDelete();break;
      case 'duplicate-file':var original=state.docs.find(function(f){return f.id===id;});if(original){state.docs.push(copyDoc(original));renderSidebar();toast(isExternal(original)?'已创建可编辑副本':'已创建完整副本');notify(isExternal(original)?'创建可编辑副本':'另存副本');}break;
      case 'dismiss':hideOverlay();break;
      case 'compat-report':showOverlay('compat');break;
      case 'edit-copy':ensureEditable(null);break;
      case 'confirm-edit-copy':createEditableCopy();break;
      case 'edit-node':beginEdit(id);break;
      case 'rename-sheet':beginSheetRename(id);break;
      case 'delete-node':removeNode();break;
      case 'export':state.exportResults=[];showOverlay('export');break;
      case 'generate-export':generateExport().catch(function(){state.error='导出失败，请重试。';renderOverlay();notify('导出失败');});break;
      case 'select-node':selectNode(id);break;
      case 'add-child':addNode(false);break;
      case 'add-sibling':addNode(true);break;
      case 'node-style':openInspector('node');break;
      case 'theme':openInspector('theme');break;
      case 'close-inspector':closeInspector();break;
      case 'set-theme':
        if(state.overlay==='style'){markChanged(function(){currentSheet().theme=id;},'切换主题',true);renderAll('切换主题');activateDialog();}
        else {markChanged(function(){currentSheet().theme=id;},'切换主题');renderInspector();}
        break;
      case 'node-fill':var node=findNode(state.selected);if(node){markChanged(function(){node.fill=id==='default'?null:id;},'修改主题填充',state.overlay==='style');renderInspector();renderOverlay();}break;
      case 'reset-node-style':var selectedNode=findNode(state.selected);if(selectedNode){markChanged(function(){selectedNode.fill=null;},'恢复主题样式',state.overlay==='style');renderInspector();renderOverlay();}break;
      case 'note':showOverlay('note');break;
      case 'save-note':var noteText=$('note-text').value,noteNode=findNode(state.selected);state.overlay=null;if(noteNode&&noteText!==noteNode.note)markChanged(function(){noteNode.note=noteText;},'编辑备注');renderAll('完成备注');$('viewport').focus();break;
      case 'collapse-node':
        var cn=findNode(id),branch=target&&target.dataset.branch;
        if(cn)markChanged(function(){
          if(cn===currentSheet().root&&branch){var key=rootCollapseKey(branch);cn[key]=!cn[key];}
          else if(cn===currentSheet().root){
            var collapseAll=!isRootFullyCollapsed(currentSheet());
            cn.children.forEach(function(child,index){cn[rootCollapseKey(rootChildSide(currentSheet().layout,child,index,cn.children.length))]=collapseAll;});
          }
          else cn.collapsed=!cn.collapsed;
        },'展开或收起主题');
        break;
      case 'set-layout':markChanged(function(){currentSheet().layout=id;state.autoFit=true;},'重新布局');break;
      case 'undo':historyChange('undo');break;
      case 'redo':historyChange('redo');break;
      case 'clear':if(current())showOverlay('clear');break;
      case 'confirm-clear':state.overlay=null;markChanged(function(){currentSheet().root.children=[];state.selected=null;state.inspector=null;},'清空当前画布');renderAll('清空当前画布');break;
      case 'fit':state.autoFit=true;renderCanvas();notify('适应画布');break;
      case 'reset-view':state.autoFit=false;state.zoom=1;state.pan={x:0,y:0};renderCanvas();notify('重置视图');break;
      case 'zoom-in':case 'zoom-out':state.autoFit=false;state.zoom=Math.max(.25,Math.min(2,state.zoom*(act==='zoom-in'?1.15:1/1.15)));renderCanvas();notify('缩放视图');break;
      case 'sheet':if(current()){
        var now=Date.now(),doubleSheet=state.lastSheetClick&&state.lastSheetClick.id===id&&now-state.lastSheetClick.time<420;
        state.lastSheetClick=doubleSheet?null:{id:id,time:now};
        if(doubleSheet){beginSheetRename(id);break;}
        if(!finishSheetRename(false))break;finishEdit(false);
        if(current().activeSheetId===id)break;
        current().activeSheetId=id;state.selected=null;state.inspector=null;state.autoFit=true;renderAll('切换画布');
      }break;
      case 'add-sheet':addSheet();break;
      case 'shortcuts':showOverlay('shortcuts');break;
    }
  }
  app.addEventListener('click',function(e){
    var t=e.target.closest('[data-act]');if(t&&app.contains(t)){if(t.disabled)return;e.stopPropagation();action(t.dataset.act,t);return;}
    if(e.target.matches('[data-backdrop]')&&!state.deleting&&!state.guardSaving){hideOverlay();return;}
    if(!e.target.closest('.popover'))closeMenu();
  });
  app.addEventListener('dblclick',function(e){var tab=e.target.closest('.sheet-tab');if(tab){e.preventDefault();beginSheetRename(tab.dataset.id);return;}var n=e.target.closest('.mm-node');if(n){e.preventDefault();beginEdit(n.dataset.id);}});
  app.addEventListener('focusout',function(e){if(e.target.id==='sheet-name-input')finishSheetRename(false);});
  app.addEventListener('input',function(e){
    if(e.target.id==='file-search'){var position=e.target.selectionStart;state.query=e.target.value;renderSidebar();$('file-search').focus();$('file-search').setSelectionRange(position,position);return;}
    if(e.target.id==='node-title'||e.target.id==='node-note'){
      var n=findNode(state.selected);if(!n)return;var prop=e.target.id==='node-title'?'text':'note',value=e.target.value;if(prop==='text'&&!value.trim())return;
      markChanged(function(){n[prop]=value;},prop==='text'?'修改主题文字':'修改备注',state.overlay==='style');
    }
  });
  app.addEventListener('change',function(e){
    if(e.target.id==='export-format'){state.exportFormat=e.target.value;state.exportResults=[];renderOverlay();notify('切换导出格式');}
    if(e.target.id==='export-range'){state.exportRange=e.target.value;state.exportResults=[];$('export-results').innerHTML='';notify('切换导出范围');}
    if(e.target.id==='export-transparent'){state.exportTransparent=e.target.checked;state.exportResults=[];$('export-results').innerHTML='';}
    if(e.target.id==='export-scale'){state.exportScale=e.target.value;state.exportResults=[];$('export-results').innerHTML='';}
  });
  $('inline-editor').addEventListener('compositionstart',function(){state.composing=true;});
  $('inline-editor').addEventListener('compositionend',function(){state.composing=false;});
  $('inline-editor').addEventListener('blur',function(){if(!state.composing)finishEdit(false);});
  $('inline-editor').addEventListener('keydown',function(e){
    if(e.isComposing||state.composing)return;
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finishEdit(false);$('viewport').focus();}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishEdit(true);$('viewport').focus();}
  });
  app.addEventListener('keydown',function(e){
    if(e.isComposing||state.composing)return;
    if(e.target.id==='sheet-name-input'){
      if(e.key==='Enter'){e.preventDefault();if(finishSheetRename(false))$('viewport').focus({preventScroll:true});}
      if(e.key==='Escape'){e.preventDefault();finishSheetRename(true);$('viewport').focus({preventScroll:true});}
      return;
    }
    if(state.deleting){if(e.key==='Escape'||e.key==='Tab'||((e.metaKey||e.ctrlKey)&&['s','o','n'].includes(e.key.toLowerCase())))e.preventDefault();return;}
    if(e.key==='Escape'){
      e.preventDefault();if(state.overlay){if(!state.guardSaving)hideOverlay();return;}if(state.menu){closeMenu();restoreFocus(menuTriggerKey);notify('关闭菜单');return;}if(state.inspector){closeInspector();return;}state.selected=null;renderCanvas();if(state.sidebarMode==='outline')renderSidebar();notify('取消选择');return;
    }
    if(state.overlay){
      if((e.metaKey||e.ctrlKey)&&['s','o','n'].includes(e.key.toLowerCase()))e.preventDefault();
      if(e.key==='Tab'){
        var focusable=Array.from($('overlay-host').querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,a[href]')).filter(function(el){return el.offsetParent!==null;});
        if(focusable.length){var first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      }return;
    }
    var input=e.target.closest('input,textarea,select,[contenteditable="true"]'),mod=e.metaKey||e.ctrlKey;
    if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();action('save');return;}
    if(input)return;
    if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();historyChange(e.shiftKey?'redo':'undo');return;}
    if(mod&&e.key==='0'){e.preventDefault();action('reset-view');return;}
    if(mod&&e.key.toLowerCase()==='o'){e.preventDefault();action('open');return;}
    if(mod&&e.key.toLowerCase()==='n'){e.preventDefault();action('new');return;}
    if(state.menu&&e.key==='Tab'){closeMenu();return;}
    var fileRow=e.target.closest('.file-row');
    if(fileRow&&(e.key==='Enter'||e.key===' ')){e.preventDefault();action('open-file',fileRow);return;}
    var inCanvas=$('viewport').contains(e.target);
    if(inCanvas&&state.selected&&e.key==='Tab'){e.preventDefault();addNode(false);return;}
    if(inCanvas&&state.selected&&e.key==='Enter'){e.preventDefault();addNode(true);return;}
    if(inCanvas&&state.selected&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();removeNode();}
  });
  var panStart;
  $('viewport').addEventListener('pointerdown',function(e){
    if(state.overlay||e.button!==0||e.target.closest('.mm-node,button,textarea,a'))return;
    panStart={x:e.clientX,y:e.clientY,pan:clone(state.pan),moved:false};$('viewport').setPointerCapture(e.pointerId);
  });
  $('viewport').addEventListener('pointermove',function(e){
    if(!panStart)return;var dx=e.clientX-panStart.x,dy=e.clientY-panStart.y;if(Math.abs(dx)+Math.abs(dy)>4)panStart.moved=true;
    if(panStart.moved){state.autoFit=false;state.pan={x:panStart.pan.x+dx,y:panStart.pan.y+dy};$('viewport').classList.add('panning');renderCanvas();}
  });
  $('viewport').addEventListener('pointerup',function(){
    if(!panStart)return;if(!panStart.moved){finishEdit(false);state.selected=null;state.inspector=null;renderInspector();renderCanvas();if(state.sidebarMode==='outline')renderSidebar();$('viewport').focus();notify('取消选择');}
    else notify('平移画布');panStart=null;$('viewport').classList.remove('panning');
  });
  $('viewport').addEventListener('pointercancel',function(){panStart=null;$('viewport').classList.remove('panning');});
  $('viewport').addEventListener('wheel',function(e){
    if(state.overlay||e.target.closest('textarea'))return;e.preventDefault();state.autoFit=false;
    if(e.ctrlKey||e.metaKey){state.zoom=Math.max(.25,Math.min(2,state.zoom*Math.exp(-e.deltaY*.003)));}else{state.pan.x-=e.deltaX;state.pan.y-=e.deltaY;}renderCanvas();
  },{passive:false});
  new ResizeObserver(function(){if(state)renderCanvas();}).observe($('viewport'));
  window.__mindmapPrototype={getState:fullState,failNext:function(kind){if(['save','delete','open'].includes(kind)){state.fail[kind]=true;return true;}return false;},reset:reset};
  reset(new URLSearchParams(location.search).get('scenario')||'default');
})();
