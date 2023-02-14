# How to build a Pokedex with Platformatic

Recently, [Matteo Collina](https://nodeland.dev/), one of Fastify's creators and much more, launched [Platformatic](https://platformatic.dev/): a _fast_ backend development platform.
Since it is built on top of Fastify, it claims to be a life changer, and I want to try it and write down my thoughts!

So, what are we going to build? A Pokedex!  

> A [Pokedex](https://pokemon.fandom.com/wiki/Pok%C3%A9dex) is a fictional device from the Pokemon franchise
> that is capable of showing information regarding the various species of the Pokémon universe.

Of course, I don't want to write a boring article, let's make it a bit more fun!  
Here are the requirements:

- The Pokemon database already exists. It will be our "legacy" system
- I want to build a React frontend. It will test Platformatic's "extensibility". Note that Platformatic is a "Backend" framework, but fastify can handle frontend too!
- The application must be read-only. I don't want to expose any API with `write` privileges.

The final application architecture will look like:

<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="516px" viewBox="-0.5 -0.5 516 341" content="&lt;mxfile&gt;&lt;diagram id=&quot;t6SQkrjZUwwSvDYo1J5F&quot; name=&quot;Page-1&quot;&gt;&lt;mxGraphModel dx=&quot;399&quot; dy=&quot;629&quot; grid=&quot;1&quot; gridSize=&quot;10&quot; guides=&quot;1&quot; tooltips=&quot;1&quot; connect=&quot;1&quot; arrows=&quot;1&quot; fold=&quot;1&quot; page=&quot;1&quot; pageScale=&quot;1&quot; pageWidth=&quot;827&quot; pageHeight=&quot;1169&quot; math=&quot;0&quot; shadow=&quot;0&quot;&gt;&lt;root&gt;&lt;mxCell id=&quot;0&quot;/&gt;&lt;mxCell id=&quot;1&quot; parent=&quot;0&quot;/&gt;&lt;mxCell id=&quot;11&quot; style=&quot;edgeStyle=none;html=1;exitX=0.5;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0;entryY=0.25;entryDx=0;entryDy=0;&quot; edge=&quot;1&quot; parent=&quot;1&quot; source=&quot;2&quot; target=&quot;3&quot;&gt;&lt;mxGeometry relative=&quot;1&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;2&quot; value=&quot;Client&quot; style=&quot;shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;145&quot; y=&quot;205&quot; width=&quot;30&quot; height=&quot;60&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;3&quot; value=&quot;Platformatic DB&quot; style=&quot;rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;spacingTop=2;fillColor=#1ba1e2;fontColor=#ffffff;strokeColor=#006EAF;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;250&quot; y=&quot;190&quot; width=&quot;280&quot; height=&quot;180&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;4&quot; value=&quot;SQLite&quot; style=&quot;shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;600&quot; y=&quot;220&quot; width=&quot;60&quot; height=&quot;80&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;10&quot; style=&quot;edgeStyle=none;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;&quot; edge=&quot;1&quot; parent=&quot;1&quot; source=&quot;5&quot; target=&quot;8&quot;&gt;&lt;mxGeometry relative=&quot;1&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;20&quot; style=&quot;edgeStyle=none;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.143;entryY=1;entryDx=0;entryDy=0;entryPerimeter=0;fontFamily=Helvetica;fontColor=default;&quot; edge=&quot;1&quot; parent=&quot;1&quot; source=&quot;5&quot; target=&quot;18&quot;&gt;&lt;mxGeometry relative=&quot;1&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;5&quot; value=&quot;Custom plugin 1&quot; style=&quot;rounded=0;whiteSpace=wrap;html=1;rotation=0;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;260&quot; y=&quot;340&quot; width=&quot;60&quot; height=&quot;50&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;8&quot; value=&quot;File System&quot; style=&quot;shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;260&quot; y=&quot;430&quot; width=&quot;60&quot; height=&quot;80&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;19&quot; style=&quot;edgeStyle=none;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.429;entryY=1.025;entryDx=0;entryDy=0;entryPerimeter=0;fontFamily=Helvetica;fontColor=default;&quot; edge=&quot;1&quot; parent=&quot;1&quot; source=&quot;13&quot; target=&quot;18&quot;&gt;&lt;mxGeometry relative=&quot;1&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;13&quot; value=&quot;Custom plugin 2&quot; style=&quot;rounded=0;whiteSpace=wrap;html=1;rotation=0;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;340&quot; y=&quot;340&quot; width=&quot;60&quot; height=&quot;50&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;15&quot; style=&quot;edgeStyle=none;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;fontFamily=Helvetica;fontColor=default;&quot; edge=&quot;1&quot; parent=&quot;1&quot; source=&quot;14&quot; target=&quot;4&quot;&gt;&lt;mxGeometry relative=&quot;1&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;14&quot; value=&quot;&amp;lt;div style=&amp;quot;line-height: 18px;&amp;quot;&amp;gt;&amp;lt;span style=&amp;quot;&amp;quot;&amp;gt;@platformatic/sql-mapper&amp;lt;/span&amp;gt;&amp;lt;/div&amp;gt;&quot; style=&quot;rounded=0;whiteSpace=wrap;html=1;fontFamily=Helvetica;fontStyle=0;rotation=0;labelBackgroundColor=none;labelBorderColor=none;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;380&quot; y=&quot;240&quot; width=&quot;150&quot; height=&quot;40&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;18&quot; value=&quot;&amp;lt;div style=&amp;quot;line-height: 18px;&amp;quot;&amp;gt;&amp;lt;span style=&amp;quot;&amp;quot;&amp;gt;Platformatic core&amp;lt;/span&amp;gt;&amp;lt;/div&amp;gt;&quot; style=&quot;rounded=0;whiteSpace=wrap;html=1;fontFamily=Helvetica;fontStyle=0;rotation=0;labelBackgroundColor=none;labelBorderColor=none;fillColor=#f5f5f5;fontColor=#333333;strokeColor=#666666;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;250&quot; y=&quot;280&quot; width=&quot;280&quot; height=&quot;40&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;mxCell id=&quot;23&quot; value=&quot;React&amp;lt;br&amp;gt;Build&quot; style=&quot;whiteSpace=wrap;html=1;shape=mxgraph.basic.document;labelBackgroundColor=none;labelBorderColor=none;fontFamily=Helvetica;fontColor=default;&quot; vertex=&quot;1&quot; parent=&quot;1&quot;&gt;&lt;mxGeometry x=&quot;310&quot; y=&quot;480&quot; width=&quot;40&quot; height=&quot;50&quot; as=&quot;geometry&quot;/&gt;&lt;/mxCell&gt;&lt;/root&gt;&lt;/mxGraphModel&gt;&lt;/diagram&gt;&lt;/mxfile&gt;" onclick="(function(svg){var src=window.event.target||window.event.srcElement;while (src!=null&amp;&amp;src.nodeName.toLowerCase()!='a'){src=src.parentNode;}if(src==null){if(svg.wnd!=null&amp;&amp;!svg.wnd.closed){svg.wnd.focus();}else{var r=function(evt){if(evt.data=='ready'&amp;&amp;evt.source==svg.wnd){svg.wnd.postMessage(decodeURIComponent(svg.getAttribute('content')),'*');window.removeEventListener('message',r);}};window.addEventListener('message',r);svg.wnd=window.open('https://viewer.diagrams.net/?client=1&amp;page=0&amp;edit=_blank');}}})(this);" style="cursor:pointer;max-width:100%;max-height:341px;"><defs/><g><path d="M 15 45 L 98.63 45" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/><path d="M 103.88 45 L 96.88 48.5 L 98.63 45 L 96.88 41.5 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><ellipse cx="15" cy="22.5" rx="7.5" ry="7.5" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/><path d="M 15 30 L 15 55 M 15 35 L 0 35 M 15 35 L 30 35 M 15 55 L 0 75 M 15 55 L 30 75" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe flex-start; justify-content: unsafe center; width: 1px; height: 1px; padding-top: 82px; margin-left: 15px;"><div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: nowrap;">Client</div></div></div></foreignObject><text x="15" y="94" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">Client</text></switch></g><rect x="105" y="0" width="280" height="180" fill="#1ba1e2" stroke="#006eaf" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe flex-start; justify-content: unsafe center; width: 278px; height: 1px; padding-top: 9px; margin-left: 106px;"><div data-drawio-colors="color: #ffffff; " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(255, 255, 255); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">Platformatic DB</div></div></div></foreignObject><text x="245" y="21" fill="#ffffff" font-family="Helvetica" font-size="12px" text-anchor="middle">Platformatic DB</text></switch></g><path d="M 455 45 C 455 36.72 468.43 30 485 30 C 492.96 30 500.59 31.58 506.21 34.39 C 511.84 37.21 515 41.02 515 45 L 515 95 C 515 103.28 501.57 110 485 110 C 468.43 110 455 103.28 455 95 Z" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><path d="M 515 45 C 515 53.28 501.57 60 485 60 C 468.43 60 455 53.28 455 45" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 58px; height: 1px; padding-top: 83px; margin-left: 456px;"><div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">SQLite</div></div></div></foreignObject><text x="485" y="86" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">SQLite</text></switch></g><path d="M 145 200 L 145 233.63" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/><path d="M 145 238.88 L 141.5 231.88 L 145 233.63 L 148.5 231.88 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><path d="M 145 150 L 145.03 136.37" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/><path d="M 145.04 131.12 L 148.52 138.12 L 145.03 136.37 L 141.52 138.11 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><rect x="115" y="150" width="60" height="50" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 58px; height: 1px; padding-top: 175px; margin-left: 116px;"><div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">Custom plugin 1</div></div></div></foreignObject><text x="145" y="179" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">Custom plu...</text></switch></g><path d="M 115 255 C 115 246.72 128.43 240 145 240 C 152.96 240 160.59 241.58 166.21 244.39 C 171.84 247.21 175 251.02 175 255 L 175 305 C 175 313.28 161.57 320 145 320 C 128.43 320 115 313.28 115 305 Z" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><path d="M 175 255 C 175 263.28 161.57 270 145 270 C 128.43 270 115 263.28 115 255" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 58px; height: 1px; padding-top: 293px; margin-left: 116px;"><div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">File System</div></div></div></foreignObject><text x="145" y="296" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">File System</text></switch></g><path d="M 225 150 L 225.08 137.37" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/><path d="M 225.11 132.12 L 228.57 139.14 L 225.08 137.37 L 221.57 139.1 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><rect x="195" y="150" width="60" height="50" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 58px; height: 1px; padding-top: 175px; margin-left: 196px;"><div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">Custom plugin 2</div></div></div></foreignObject><text x="225" y="179" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">Custom plu...</text></switch></g><path d="M 385 70 L 448.63 70" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/><path d="M 453.88 70 L 446.88 73.5 L 448.63 70 L 446.88 66.5 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><rect x="235" y="50" width="150" height="40" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 148px; height: 1px; padding-top: 70px; margin-left: 236px;"><div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;"><div style="line-height: 18px;"><span style="">@platformatic/sql-mapper</span></div></div></div></div></foreignObject><text x="310" y="74" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">@platformatic/sql-mapper</text></switch></g><rect x="105" y="90" width="280" height="40" fill="#f5f5f5" stroke="#666666" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 278px; height: 1px; padding-top: 110px; margin-left: 106px;"><div data-drawio-colors="color: #333333; " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(51, 51, 51); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;"><div style="line-height: 18px;"><span style="">Platformatic core</span></div></div></div></div></foreignObject><text x="245" y="114" fill="#333333" font-family="Helvetica" font-size="12px" text-anchor="middle">Platformatic core</text></switch></g><path d="M 204.6 297.14 L 204.6 340 L 165 340 L 165 290 L 198.94 290 Z" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><path d="M 198.94 290 C 199.4 291.67 198.64 293.39 196.92 294.59 L 204.6 297.3" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/><g transform="translate(-0.5 -0.5)"><switch><foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;"><div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 38px; height: 1px; padding-top: 315px; margin-left: 166px;"><div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;"><div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">React<br />Build</div></div></div></foreignObject><text x="185" y="319" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">React...</text></switch></g></g><switch><g requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility"/><a transform="translate(0,-5)" xlink:href="https://www.diagrams.net/doc/faq/svg-export-text-problems" target="_blank"><text text-anchor="middle" font-size="10px" x="50%" y="100%">Text is not SVG - cannot display</text></a></switch></svg>

Now that we have the requirements let's start!


## Creating the Platformatic project

We can start by creating the Platformatic project.
I followed the [Plafromatic documentation](https://oss.platformatic.dev/docs/getting-started/quick-start-guide/#create-a-new-api-project)
that is well-written and helpful.

So, I'm going to recap what I did briefly.

### Installation

The installation requires Node.js >= v18.8.0, and then we can run one single command:

```bash
npm create platformatic@latest
```

Then, the installer will ask you some questions.  
Here is my complete output:

```sh
Need to install the following packages:
  create-platformatic@0.12.1
Ok to proceed? (y) y
 Hello, Manuel Spigolon welcome to Platformatic 0.12.1!
 Let's start by creating a new project.
? Which kind of project do you want to create? DB
? Where would you like to create your project? .
? Do you want to create default migrations? yes
? Do you want to create a plugin? yes
? Do you want to use TypeScript? no
[10:25:02] INFO: Configuration file platformatic.db.json successfully created.
[10:25:02] INFO: Environment file .env successfully created.
[10:25:02] INFO: Migrations folder migrations successfully created.
[10:25:02] INFO: Migration file 001.do.sql successfully created.
[10:25:02] INFO: Migration file 001.undo.sql successfully created.
[10:25:02] INFO: Plugin file created at plugin.js
? Do you want to run npm install? yes
✔ ...done!
? Do you want to apply migrations? no
? Do you want to generate types? no
[10:26:36] INFO: Configuration schema successfully created.
? Do you want to create the github action to deploy this application to Platformatic Cloud? yes
[10:26:40] INFO: Github action successfully created, please add PLATFORMATIC_API_KEY as repository secret.
 
All done! Please open the project directory and check the README.
```

After this setup, we have an empty project ready to be adapted to our needs.

### Database Preparation

The `migrations/` folder was created during the project generation.  
This folder will contain the database schema and the data that Platformatic will use to create the SQLite database.

Here must remove all the files and create:

- The `001.do.schema.sql` file that will contain the database schema.
- The `002.do.data.sql` file that will contain the database data.

These files represent our "legacy" system.

The following image shows the raw Entity-Relation schema for our Pokedex:

![Pokedex DB Schema](./assets/pokedex-er.png)

We must write down the SQL code into the `001.do.schema.sql` file.
It will be the first migration file to execute.

Then we need to fill the schema so that we will extract the data from [Poke API](https://pokeapi.co/docs/v2#pokemon).
I used the following GraphQL query to collect all the Pokemon data:

```gql
query gottaCatchThemAll {
  pokemon: pokemon_v2_pokemon {
    id
    name
    height
    weight
    types: pokemon_v2_pokemontypes {
      type: pokemon_v2_type {
        name
        id
      }
    }
    images: pokemon_v2_pokemonsprites {
      sprites
    }
    specy:pokemon_v2_pokemonspecy {
      generation_id
      is_baby
      is_legendary
      is_mythical
      color:pokemon_v2_pokemoncolor {
        name
        id
      }
      evolutions: pokemon_v2_evolutionchain {
        baby_trigger_item_id
        id
        chain: pokemon_v2_pokemonspecies {
          id
          order
        }
      }
    }
  }
}
```

Then, with a [simple magical Node.js script](https://github.com/Eomm/pokedex/blob/main/scripts/generatePokebase.js),
we can save the `INSERT` statements into a `002.do.data.sql` file.

At this point, we have the database schema and the data.  
Now we are ready to wire Platformatic with our custom database.  
To do so, I created some additional `scripts` in the `package.json`:

```
{
  "scripts": {
    "start": "platformatic db start",
    "db:migrations": "platformatic db migrations apply",
    "db:types": "platformatic db types"
  }
}
```

> I love this setup because it will execute the installed `platformatic` CLI
> and I must not remember complex commands

So, by running the `npm run db:migrations` command:

- it will create an SQLite database with our Pokemons!
- the `types/` folder is generated to help us during the development phase!

We are ready to execute `npm start` to spin up our server!  
If all is correctly working you will be able to open a browser at `http://localhost:3042/pokemon/6`
to see the most powerful Pokemon 🔥!


## Adding a User Interface to Platformatic

This website is **backend.cafe**, so I'm not going to annoy you explaining how I built the Pokedex UI,
I'm still improving my frontend skill set.
It is worth mentioning that the React.js application and the Platformatic auto-reload are nice and shiny during the implementation phase.

Here is a preview of what I have built so far:

![Pokedex UI preview](./assets/pokedex-ui.png)

This UI has some challenges for the backend too:

- Serve the website pages
- A very long list to show with pagination
- A search form
- A `<select>` input item with a list of the database's data

Let's solve it all!

### Serve a static website

To serve static files with Fastify, you need to use [`@fastify/static`](https://github.com/fastify/fastify-static) plugin.  
And I used it with Platformatic because all the Fastify's plugins are compatible!

As a Fastify user, doing it has been effortless. I created a `/static-website.js` file that does what I need:

```js
const path = require('path')
const fastifyStatic = require('@fastify/static')

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.register(fastifyStatic, {
    root: path.join(__dirname, 'pokedex-ui/build'),
    decorateReply: false
  })
}
```

The code is quite straightforward but has one fabulous addition.  
The `jsdoc` comment before the `module.exports` statement enables a cool autocompletion feature adding your whole database!

![Platformatic autocompletion](./assets/autocompletion.png)

This pattern works for TypeScript users and pure JavaScript developers too!

After implementing our custom code, we must integrate it into Platformatic, so we need to edit the core of our Platformatic application, the `platformatic.db.json` file.  
This [configuration file controls](https://oss.platformatic.dev/docs/next/reference/db/configuration) everything
on our application, such as:

- The HTTP server
- The additional plugins and integrations
- The different environments
- The authorizations
- The application metrics and monitoring
- ..and many other things

In our case, we need to add our `static-website.js` to the `plugins` section and turn the `dashboard` offline:

```json5
{
  // ... other Platformatic settings
  "dashboard": false,
  "plugin": [
    {
      "path": "static-website.js"
    }
  ]
}
```

By default, Platformatic serves a dashboard as the root endpoint `/`.  
It is insightful to explore all the endpoints Platformatic generated for us.  
In my case, I wanted to serve the Pokedex UI as the root path, so I had to turn it off. (Note there is a feature request [to customize the dashboard endpoint](https://github.com/platformatic/platformatic/issues/657))

### How to implement the pagination and the search form

Well... I don't have too much to say here because **it works out of the box**!  
To implement it, I need two queries:

- One to search a slice of the whole dataset
- One to count the whole dataset by using the same filters of the search query

Under the hood, Platformatic is using the [`@platformatic/sql-mapper`](https://oss.platformatic.dev/docs/reference/sql-mapper/introduction) plugin to generate a set of APIs from a database schema.
[Here, you can find a complete list](https://oss.platformatic.dev/docs/reference/sql-mapper/entities/api) of the generated endpoints. This plugin can generate what you need to implement the pagination and the search form without any extra configuration!

The queries are the following:

```gql
query searchPokemon($limit: LimitInt, $offset: Int, $name: String, $gen: [Int]) {
  pokemon(limit: $limit, offset: $offset, where: {name: {like: $name}, generation: { in: $gen } }) {
    id
    name
    picture { url }
    isLegendary
  }
}

query countSearchPokemon($name: String, $gen: [Int]) {
  countPokemon(where: {name: {like: $name}, generation: { in: $gen }}) {
    total
  }
}
```

As you can see, the only difference is that the first query manages the `limit` and `offset` parameters that are a standard de facto for every pagination.

Moreover, every generated endpoint has a [complete query system](https://oss.platformatic.dev/docs/reference/sql-mapper/entities/api#where-clause) to filter the data!

I enjoyed focusing only on my Pokedex UI, without needing to implement or change something in the backend.


### How to run a custom query

The `Generation` select item in the search box should list all the Pokemon's generations.
This query is too specific, and our database schema doesn't facilitate how Platformatic generates such a query. So we need to write a custom endpoint!

Since Platformatic generates REST and GraphQL endpoints by default, we need to choose if we want to implement the custom endpoint as REST or GQL or both: it is up to us.

I will go for the GQL one because my UI relies on GraphQL to communicate with the backend.

The operation consists in two steps:

1. Extend the GQL Schema by declaring the custom Query
2. Implment the new Query resolver

If you don't know GQL and these steps are not clear, I think that reading [these articles](https://backend.cafe/series/mercurius)
will help you to introduce yourself to GraphQL.

```js
/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  // 1. Extend the GQL Schema
  app.graphql.extendSchema(`
    extend type Query {
      generations: [Int]
    }
  `)

  // 2. Implement the resolver
  app.graphql.defineResolvers({
    Query: {
      generations: async function (source, args, context, info) {
        const sql = app.platformatic.sql('SELECT DISTINCT generation FROM Pokemon ORDER BY generation ASC')
        const generations = await app.platformatic.db.query(sql)
        return generations.map(g => g.generation)
      }
    }
  })
}
```

The handler runs a raw SQL query and returns the results - nice and easy.
As documented, the `app.platformatic.sql` decorator returns the [`@database`](https://www.atdatabases.org/)
instance already configured a ready to be used. This module provides a comprehensive set of features to query your database, protecting it from SQL injections.

### How to expose read-only endpoints

By default, Platformatic doesn't perform any authorization check, but we can configure it in the`platformatic.db.json` file. 
Adding a simple `authorization: {}` property will turn authentication on.  
This configuration will block everything because this setup is all blocked by default now.

Since we want to provide read access only, we need to list all the entities we want to grant read access.

Here is a small example:

```json5
{
  // .. other configuration properties
  "authorization": {
    "rules": [
      {
        "role": "anonymous",
        "entity": "pokemon",
        "find": true,
        "save": false,
        "delete": false
      },
      {
        "role": "anonymous",
        "entity": "pokemonElement",
        "find": true,
        "save": false,
        "delete": false
      },
      {
        "role": "anonymous",
        "entity": "picture",
        "find": true,
        "save": false,
        "delete": false
      }
      // .. repeat for every database entity
    ]
  }
}
```

With the previous setup, we are granting to any `anonymous` users the `find` operation while blocking the `save` (aka `insert` and `update`) and the `delete` ones.
This example is simple with `true` and `false` values, but every rule item may contain more complex checks as [broadly documented](https://oss.platformatic.dev/docs/reference/db/authorization/rules).

Restarting our Platformatic service with the new configuration, will block any `DELETE` or `PATCH` calls to our endpoints 🛡️

### How to deploy it?

This step is always a pain for me because I need to search for a small and free infrastructure where I can publish my experiments and skill up - possibly without providing my credit card!

If you read the installation process output carefully, there was this option:

> Do you want to create the github action to deploy this application to Platformatic Cloud? yes

So, the deployment to the [Platformatic beta environment](https://platformatic.cloud/) took me these steps:

- Login to [https://platformatic.cloud/](https://platformatic.cloud/)
- Generate an API key
- Copy and paste the API key to the GitHub repository's secrets
- Done!

Nice and shiny! So, by opening a pull request, I get a [clear message](https://github.com/Eomm/pokedex/pull/2#issuecomment-1373335670)
that link me [my live application](https://sable-happy-alluring-shirt.deploy.space/)!  
I never try a smoother process than this one! 👏


## Summary

After building this small project, I think Platformatic is not just an ORM as it may seem but an enhanced version of Fastify.  
It implements a lot of good practices and boring stuff that enable us to spin up a fastify instance with:

- A solid database interface and upgrade process
- A good authentication and authorization
- Application already wired to gather metric and measurements
- Easy to apply CORS settings
- ..all this is extendible with custom Fastify plugins, so all you already did can still be used

Of course, we did not cover all these topics in this article but I hope you would like to try them out.
The last important thing to mention is that Platformatic has not yet reached the v1 release. It is still under development and adds many new cool features at every release.  
I'm curious to know what the `v1` version will include!

As always, you can find the source coda at [https://github.com/Eomm/pokedex](https://github.com/Eomm/pokedex).  
If you enjoyed this article, comment, share, and follow me on [Twitter @ManuEomm](https://twitter.com/ManuEomm)!
