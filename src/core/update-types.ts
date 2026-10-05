                                                                                       
export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  available: boolean;
  installation: "global" | "local" | "development";
  state: "idle" | "installing" | "installed" | "failed";
  installedVersion?: string;
  error?: string;
}

export interface UpdateApiStatus extends UpdateStatus {
  token: string;
}
