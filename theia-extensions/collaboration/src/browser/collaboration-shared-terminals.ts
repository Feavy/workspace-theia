import { FrontendApplicationStateService } from "@theia/core/lib/browser/frontend-application-state";
import { ApplicationShell } from "@theia/core/lib/browser/shell";
import { inject, injectable } from "@theia/core/shared/inversify";
import { TerminalWidget } from "@theia/terminal/lib/browser/base/terminal-widget";
import { TerminalService } from "@theia/terminal/lib/browser/base/terminal-service";

@injectable()
export class CollaborationSharedTerminals {
    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;
    
    private terminals: Set<number> = new Set<number>();

    public init(terminalIds: number[]) {
        console.log("[CollaborationSharedTerminals] init", terminalIds);
        this.stateService.onStateChanged(async state => {
            if (state === 'ready') {
                console.log("[CollaborationSharedTerminals] ready", terminalIds);
                const openTerminals = this.shell.widgets.filter(widget => widget instanceof TerminalWidget) as TerminalWidget[];
                console.log("[CollaborationSharedTerminals] open terminals", openTerminals.map(t => t.terminalId));
                for(const terminal of openTerminals) {
                    if(!terminalIds.includes(terminal.terminalId)) {
                        terminal.close(); // close the terminal if it is not in the list of terminals to be shared
                        continue;
                    }
                    this.handleTerminal(terminal);
                }

                for(const terminalId of terminalIds) {
                    const terminal = openTerminals.find(t => t.terminalId === terminalId);
                    if(!terminal) {
                        // create terminal
                        console.log("[CollaborationSharedTerminals] create terminal", terminalId);
                        const term = await this.terminalService.newTerminal({});
                        term.start(terminalId);
                        this.terminalService.open(term, {
                            widgetOptions: {
                                area: 'bottom'
                            }
                        });
                        this.handleTerminal(term);
                    }
                }

                console.log("[CollaborationSharedTerminals] Terminals", this.terminals);
            }
        });

        this.shell.onDidAddWidget(widget => {
            if (widget instanceof TerminalWidget) {
                this.handleTerminal(widget);
            }
        });
    }

    private handleTerminal(terminal: TerminalWidget) {
        terminal.onDidOpen(() => {
            this.terminals.add(terminal.terminalId);
            console.log("[CollaborationSharedTerminals] add terminal", this.terminals);
        });
        terminal.onDidDispose(() => {
            this.terminals.delete(terminal.terminalId);
            console.log("[CollaborationSharedTerminals] remove terminal", this.terminals);
        });
    }
}