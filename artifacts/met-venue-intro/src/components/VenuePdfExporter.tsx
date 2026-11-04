import { useEffect, useRef, useState } from 'react';

import { slides } from '@/slideLoader';
import {
  parseVenueIntroProfile,
  type VenueIntroProfile,
} from '@/data/venueIntroProfiles';
import { isSpanish } from '@/data/language';

type ExportFile = {
  name: string;
  url: string;
};

type Props = {
  onClose: () => void;
};

const PDF_PAGE_WIDTH = 960;
const PDF_PAGE_HEIGHT = 540;
const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;

function filenamePart(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'Venue'
  );
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForImages(container: ParentNode) {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener(
            'error',
            () => reject(new Error(`Could not load slide image: ${image.src}`)),
            { once: true },
          );
        });
      }
      if (image.naturalWidth === 0) {
        throw new Error(`Could not load slide image: ${image.src}`);
      }
      if (typeof image.decode === 'function') {
        await image.decode();
      }
    }),
  );
}

function startDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function VenuePdfExporter({ onClose }: Props) {
  const [profiles, setProfiles] = useState<VenueIntroProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState('');
  const [profilesReload, setProfilesReload] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<ExportFile[]>([]);
  const [archive, setArchive] = useState<ExportFile | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const loadProfiles = async () => {
      setProfilesLoading(true);
      setProfilesError('');
      try {
        const response = await fetch('/api/venue-intro-profiles', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`Could not load venue profiles (HTTP ${response.status}).`);
        }
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) {
          throw new Error('The venue profile list has an invalid format.');
        }
        const nextProfiles = payload.map(parseVenueIntroProfile);
        if (
          nextProfiles.length === 0 ||
          nextProfiles.some((profile) => profile === null) ||
          new Set(nextProfiles.map((profile) => profile?.key)).size !==
            nextProfiles.length
        ) {
          throw new Error('The venue profile list is empty or contains invalid entries.');
        }
        if (!cancelled) setProfiles(nextProfiles as VenueIntroProfile[]);
      } catch (cause) {
        if (!cancelled) {
          setProfilesError(
            cause instanceof Error
              ? cause.message
              : 'Could not load venue profiles. Please try again.',
          );
        }
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    };
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [profilesReload]);

  const toggleSelection = (key: string) => {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key],
    );
  };

  const setAllSelected = () => {
    setSelectedKeys(profiles.map(({ key }) => key));
  };

  const clearPreviousFiles = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setFiles([]);
    setArchive(null);
  };

  const renderProfile = (profile: VenueIntroProfile) =>
    new Promise<void>((resolve, reject) => {
      const frame = frameRef.current;
      if (!frame) {
        reject(new Error('The slide export frame is unavailable.'));
        return;
      }
      const frameBase = new URL(import.meta.env.BASE_URL, window.location.origin);
      const frameUrl = new URL('allslides', frameBase);
      frameUrl.searchParams.set('venueProfile', JSON.stringify(profile));
        if (isSpanish) frameUrl.searchParams.set('lang', 'es');
      frame.onload = () => resolve();
      frame.onerror = () =>
        reject(new Error('The tailored slide deck could not be loaded.'));
      frame.src = frameUrl.toString();
    });

  const generatePdfs = async () => {
    if (
      selectedKeys.length === 0 ||
      generating ||
      profilesLoading ||
      profilesError
    ) {
      return;
    }
    if (slides.length === 0) {
      setError('The venue introduction has no slides to export.');
      return;
    }

    setGenerating(true);
    setError('');
    setProgress('Preparing selected venues…');
    clearPreviousFiles();

    const generatedFiles: Array<{ name: string; blob: Blob }> = [];

    try {
      const [{ toCanvas }, { jsPDF }, { default: JSZip }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
        import('jszip'),
      ]);

      for (let profileIndex = 0; profileIndex < selectedKeys.length; profileIndex++) {
        const key = selectedKeys[profileIndex];
        const profile = profiles.find((item) => item.key === key);
        if (!profile) throw new Error('A selected venue profile is unavailable.');

        await renderProfile(profile);
        await waitForPaint();

        const stage = frameRef.current?.contentDocument;
        if (!stage) throw new Error('The slide export frame could not be read.');
        if (stage.querySelector('[data-profile-error]')) {
          throw new Error(`The profile for ${profile.venueName} could not be rendered.`);
        }
        await frameRef.current?.contentDocument?.fonts.ready;
        await waitForImages(stage);

        const slideElements = Array.from(
          stage.querySelectorAll<HTMLElement>('[data-slide-id]'),
        );
        if (slideElements.length !== slides.length) {
          throw new Error(
            `Expected ${slides.length} slides for ${profile.venueName}, but found ${slideElements.length}.`,
          );
        }

        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'pt',
          format: [PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT],
          compress: true,
        });

        for (let slideIndex = 0; slideIndex < slideElements.length; slideIndex++) {
          setProgress(
            `${profile.venueName}: slide ${slideIndex + 1} of ${slideElements.length} · venue ${profileIndex + 1} of ${selectedKeys.length}`,
          );
          const canvas = await toCanvas(slideElements[slideIndex], {
            backgroundColor: '#fffdf7',
            height: SOURCE_HEIGHT,
            width: SOURCE_WIDTH,
            pixelRatio: 1.5,
            cacheBust: true,
          });

          if (slideIndex > 0) {
            pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT], 'landscape');
          }
          pdf.addImage(
            canvas.toDataURL('image/jpeg', 0.94),
            'JPEG',
            0,
            0,
            PDF_PAGE_WIDTH,
            PDF_PAGE_HEIGHT,
            undefined,
            'FAST',
          );
          const slideRect = slideElements[slideIndex].getBoundingClientRect();
          const scaleX = PDF_PAGE_WIDTH / SOURCE_WIDTH;
          const scaleY = PDF_PAGE_HEIGHT / SOURCE_HEIGHT;
          slideElements[slideIndex]
            .querySelectorAll<HTMLAnchorElement>('a[href]')
            .forEach((anchor) => {
              const rect = anchor.getBoundingClientRect();
              const left = Math.max(0, rect.left - slideRect.left);
              const top = Math.max(0, rect.top - slideRect.top);
              const right = Math.min(slideRect.width, rect.right - slideRect.left);
              const bottom = Math.min(slideRect.height, rect.bottom - slideRect.top);
              if (right <= left || bottom <= top) return;
              pdf.link(
                left * scaleX,
                top * scaleY,
                (right - left) * scaleX,
                (bottom - top) * scaleY,
                { url: anchor.href },
              );
            });
          canvas.width = 0;
          canvas.height = 0;
        }

        const name = `Met - ${filenamePart(profile.venueName)} - Venue Introduction.pdf`;
        generatedFiles.push({ name, blob: pdf.output('blob') });
      }

      const zip = new JSZip();
      generatedFiles.forEach(({ name, blob }) => zip.file(name, blob));
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE',
      });
      const nextFiles = generatedFiles.map(({ name, blob }) => {
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        return { name, url };
      });
      const archiveName = 'Met - Venue Introductions.zip';
      const archiveUrl = URL.createObjectURL(zipBlob);
      objectUrlsRef.current.push(archiveUrl);

      setFiles(nextFiles);
      setArchive({ name: archiveName, url: archiveUrl });
      setProgress(
        `Ready: ${generatedFiles.length} separate ${slides.length}-slide PDF${generatedFiles.length === 1 ? '' : 's'}.`,
      );
      startDownload(archiveUrl, archiveName);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The PDFs could not be generated. Please try again.',
      );
      setProgress('');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="fixed inset-0 z-50 overflow-y-auto bg-[#f4f5ef] px-5 py-8 text-[#183c2f] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={onClose}
          className="mb-8 inline-flex min-h-11 items-center rounded-full border border-[#c7d4cb] bg-white px-5 text-sm font-semibold text-[#183c2f] transition hover:bg-[#e8eee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26735a]"
        >
          ← Back to introduction
        </button>

        <header className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#26735a]">
            Met venue introductions
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Create tailored PDFs
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#52645a]">
            Choose one or more venue profiles. Each selection gets its own
            {slides.length}-slide PDF; slides 1–3 are tailored, and the shared product slides
            stay the same.
          </p>
        </header>

        <section
          aria-labelledby="venue-profile-heading"
          className="rounded-3xl border border-[#dbe3da] bg-white p-5 shadow-[0_18px_60px_rgba(18,59,45,0.08)] sm:p-7"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="venue-profile-heading" className="text-lg font-bold">
                Known venue profiles
              </h2>
              <p className="mt-1 text-sm text-[#65736a]">
                {selectedKeys.length} of {profiles.length} selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={setAllSelected}
                disabled={generating}
                className="rounded-full px-3 py-2 text-sm font-semibold text-[#26735a] hover:bg-[#eff5ef] disabled:opacity-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedKeys([])}
                disabled={generating}
                className="rounded-full px-3 py-2 text-sm font-semibold text-[#52645a] hover:bg-[#f3f5f2] disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>

          {profilesLoading ? (
            <p className="py-8 text-sm text-[#65736a]" role="status">
              Loading venue profiles…
            </p>
          ) : profilesError ? (
            <div className="space-y-3 rounded-xl bg-[#fff0ed] p-4 text-sm text-[#9b2f20]" role="alert">
              <p>{profilesError}</p>
              <button
                type="button"
                className="font-semibold underline underline-offset-4"
                onClick={() => setProfilesReload((attempt) => attempt + 1)}
              >
                Retry loading profiles
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#e8ede7]">
              {profiles.map((profile) => {
                const checked = selectedKeys.includes(profile.key);
                return (
                  <label
                    key={profile.key}
                    className={`flex cursor-pointer items-center gap-4 py-4 ${
                      generating ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(profile.key)}
                      disabled={generating}
                      className="h-5 w-5 shrink-0 accent-[#26735a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26735a]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[#183c2f]">
                        {profile.venueName}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-[#65736a]">
                        {profile.coverCopy}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={generatePdfs}
            disabled={
              selectedKeys.length === 0 ||
              generating ||
              profilesLoading ||
              Boolean(profilesError)
            }
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#26735a] px-6 font-semibold text-white transition hover:bg-[#1d5c47] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#183c2f] disabled:cursor-not-allowed disabled:bg-[#9bad9e]"
          >
            {generating ? 'Creating PDFs…' : 'Create selected PDFs'}
          </button>

          {progress && (
            <p className="mt-4 text-sm font-medium text-[#52645a]" role="status">
              {progress}
            </p>
          )}
          {error && (
            <p
              className="mt-4 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-medium text-[#9b2f20]"
              role="alert"
            >
              {error}
            </p>
          )}
        </section>

        {files.length > 0 && (
          <section
            aria-labelledby="download-heading"
            className="mt-6 rounded-3xl border border-[#dbe3da] bg-white p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 id="download-heading" className="text-lg font-bold">
                  Your PDFs are ready
                </h2>
                <p className="mt-1 text-sm text-[#65736a]">
                  The ZIP contains one separately named PDF for each selected venue.
                </p>
              </div>
              {archive && (
                <a
                  href={archive.url}
                  download={archive.name}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#183c2f] px-5 text-sm font-semibold text-white hover:bg-[#102d23] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26735a]"
                >
                  Download all PDFs
                </a>
              )}
            </div>
            <ul className="mt-5 space-y-2">
              {files.map((file) => (
                <li key={file.name}>
                  <a
                    href={file.url}
                    download={file.name}
                    className="text-sm font-semibold text-[#26735a] underline underline-offset-4 hover:text-[#183c2f]"
                  >
                    {file.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <iframe
        ref={frameRef}
        aria-hidden="true"
        title="Tailored slide export renderer"
        tabIndex={-1}
        className="pointer-events-none fixed left-[-10000px] top-0 -z-10 border-0"
        style={{ width: SOURCE_WIDTH, height: SOURCE_HEIGHT }}
      />
    </main>
  );
}
