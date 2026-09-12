export type AppleSignInResult = {
  fullName: string | null;
};

type RunAppleSignInOptions = {
  signIn: () => Promise<AppleSignInResult | null>;
  setBusy: (busy: boolean) => void;
  onSuccess: (result: AppleSignInResult) => Promise<void>;
  onError: () => void;
};

export async function runAppleSignIn({
  signIn,
  setBusy,
  onSuccess,
  onError,
}: RunAppleSignInOptions): Promise<void> {
  setBusy(true);
  try {
    const result = await signIn();
    if (result) {
      await onSuccess(result);
    }
  } catch {
    onError();
  } finally {
    setBusy(false);
  }
}