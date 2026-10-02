import { useCallback, useEffect, useRef, useState } from 'react';

export type DocumentAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type Options<T> = {
  documentId: string | null;
  enabled: boolean;
  value: T | null;
  save: (value: T) => Promise<void>;
  delay?: number;
};

export function useDocumentAutosave<T>({
  documentId,
  enabled,
  value,
  save,
  delay = 1200,
}: Options<T>) {
  const [status, setStatus] = useState<DocumentAutosaveStatus>('idle');
  const [retryVersion, setRetryVersion] = useState(0);
  const activeDocumentRef = useRef<string | null>(null);
  const lastSavedFingerprintRef = useRef('');
  const latestFingerprintRef = useRef('');
  const saveRef = useRef(save);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const timeoutRef = useRef<number | null>(null);
  const latestValueRef = useRef<T | null>(value);
  const enabledRef = useRef(enabled);
  const fingerprint = value === null ? '' : JSON.stringify(value);

  saveRef.current = save;
  latestFingerprintRef.current = fingerprint;
  latestValueRef.current = value;
  enabledRef.current = enabled;

  const enqueueSave = useCallback((snapshot: T, snapshotFingerprint: string, snapshotDocumentId: string) => {
    const saveOperation = saveRef.current;
    setStatus('saving');
    queueRef.current = queueRef.current.then(async () => {
      try {
        await saveOperation(snapshot);
        if (activeDocumentRef.current !== snapshotDocumentId) return;
        lastSavedFingerprintRef.current = snapshotFingerprint;
        setStatus(latestFingerprintRef.current === snapshotFingerprint ? 'saved' : 'pending');
      } catch (error) {
        console.error('Could not autosave document draft:', error);
        if (activeDocumentRef.current === snapshotDocumentId) setStatus('error');
      }
    });
  }, []);

  useEffect(() => {
    if (!documentId || !enabled || value === null) {
      activeDocumentRef.current = documentId;
      lastSavedFingerprintRef.current = fingerprint;
      setStatus('idle');
      return;
    }

    if (activeDocumentRef.current !== documentId) {
      activeDocumentRef.current = documentId;
      lastSavedFingerprintRef.current = fingerprint;
      setStatus('saved');
      return;
    }

    if (fingerprint === lastSavedFingerprintRef.current) {
      setStatus('saved');
      return;
    }

    setStatus('pending');
    const snapshot = value;
    const snapshotFingerprint = fingerprint;
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      enqueueSave(snapshot, snapshotFingerprint, documentId);
    }, delay);

    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [delay, documentId, enabled, enqueueSave, fingerprint, retryVersion, value]);

  const flush = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const currentDocumentId = activeDocumentRef.current;
    const currentValue = latestValueRef.current;
    const currentFingerprint = latestFingerprintRef.current;
    if (!enabledRef.current || !currentDocumentId || currentValue === null) return;
    if (currentFingerprint === lastSavedFingerprintRef.current) return;
    enqueueSave(currentValue, currentFingerprint, currentDocumentId);
  }, [enqueueSave]);

  return {
    status,
    retry: () => setRetryVersion((current) => current + 1),
    flush,
  };
}
