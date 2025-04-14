export default class WorkspaceClient {
    private baseUrl: string;

    public constructor(workspaceServerUrl: string) {
        this.baseUrl = `${workspaceServerUrl}/api`;
    }

    public async getRoom(): Promise<{
        loginToken: string,
        roomToken: string,
    }> {
        return await fetch(`${this.baseUrl}/collaboration/room`, {
            credentials: 'include',
            method: 'GET',
        }).then(response => response.json()) 
    }
}