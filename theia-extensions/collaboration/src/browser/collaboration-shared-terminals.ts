import { FrontendApplicationStateService } from "@theia/core/lib/browser/frontend-application-state";
import { ApplicationShell } from "@theia/core/lib/browser/shell";
import { inject, injectable } from "@theia/core/shared/inversify";
import { TerminalWidget } from "@theia/terminal/lib/browser/base/terminal-widget";
import { TerminalService } from "@theia/terminal/lib/browser/base/terminal-service";
import * as Y from "yjs";

@injectable()
export class CollaborationSharedTerminals {
    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    private yjs: Y.Doc;
    private yTerminals: Y.Map<boolean>;

    public async init(yjs: Y.Doc) {
        console.log("[CollaborationSharedTerminals] init");
        this.yjs = yjs;
        this.yTerminals = this.yjs.getMap<boolean>('terminals');
        console.log("[CollaborationSharedTerminals] yTerminals", this.yTerminals.toJSON());

        this.yTerminals.observe(() => {
            console.log("[CollaborationSharedTerminals] yTerminals changed", this.yTerminals.toJSON());
            this.updateTerminals()
        });
        
        this.shell.onDidAddWidget(widget => {
            if (widget instanceof TerminalWidget) {
                this.yTerminals.set(widget.terminalId.toString(), true);
                widget.onDidDispose(() => this.onCloseTerminal(widget.terminalId));
            }
        });

        await this.updateTerminals();
        
        const openTerminals = this.shell.widgets.filter(widget => widget instanceof TerminalWidget) as TerminalWidget[];
        for (const terminal of openTerminals) {
            terminal.onDidDispose(() => this.onCloseTerminal(terminal.terminalId));
        }
    }
    
    public async updateTerminals() {
        const sharedTerminals = this.yTerminals.toJSON();

        const openTerminals = this.shell.widgets.filter(widget => widget instanceof TerminalWidget) as TerminalWidget[];
        for (const terminal of openTerminals) {
            if (!this.yTerminals.has(terminal.terminalId.toString())) {
                terminal.close(); // Close the terminal if it is not in the shared list
            }
        }

        // Open shared terminals
        for(const terminalId of Object.keys(sharedTerminals)) {
            const terminal = openTerminals.find(t => t.terminalId === parseInt(terminalId));
            if(!terminal) {
                // create terminal
                console.log("[CollaborationSharedTerminals] New terminal", terminalId);
                const newTerminal = await this.terminalService.newTerminal({});
                newTerminal.start(parseInt(terminalId));
                this.terminalService.open(newTerminal, {
                    widgetOptions: {
                        area: 'bottom'
                    }
                });
                newTerminal.onDidDispose(() => this.onCloseTerminal(newTerminal.terminalId));
            }
        }
    }

    public async onCloseTerminal(terminalId: number) {
        console.log("[CollaborationSharedTerminals] close terminal", terminalId);
        this.yTerminals.delete(terminalId.toString());
    }
}