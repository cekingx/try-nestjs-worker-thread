export class WorkerResp {
  isSuccess: boolean;
  data?: WorkerSuccessResp | undefined;
  error?: WorkerErrorResp | undefined;
}

export class WorkerSuccessResp {
  salt: number;
  address: string;
}

export class WorkerErrorResp {
  message: string;
}
