type RunGoogleSignInOptions = {
  signIn: () => Promise<string | null>;
  setBusy: (busy: boolean) => void;
  onSuccess: () => Promise<void>;
  onError: () => void;
};

export async function runGoogleSignIn({
  signIn,
  setBusy,
  onSuccess,
  onError,
}: RunGoogleSignInOptions): Promise<void> {
  setBusy(true);
  try {
    const uid = await signIn();
    if (uid) {
      await onSuccess();
    }
  } catch {
    onError();
  } finally {
    setBusy(false);
  }
}