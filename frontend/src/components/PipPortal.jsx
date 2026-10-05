import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export const isPipSupported = () => {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
};

export default function PipPortal({ isOpen, onClose, children, width = 520, height = 620 }) {
  const [container, setContainer] = useState(null);
  const pipWindowRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (pipWindowRef.current) {
        try { pipWindowRef.current.close(); } catch (e) {}
        pipWindowRef.current = null;
      }
      setContainer(null);
      return;
    }

    if (!isPipSupported()) {
      return;
    }

    const openPip = async () => {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width,
          height,
        });

        pipWindowRef.current = pipWin;

        // Copy stylesheets to PiP window
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            if (sheet.cssRules) {
              const newStyle = pipWin.document.createElement('style');
              newStyle.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
              pipWin.document.head.appendChild(newStyle);
            } else if (sheet.href) {
              const newLink = pipWin.document.createElement('link');
              newLink.rel = 'stylesheet';
              newLink.href = sheet.href;
              pipWin.document.head.appendChild(newLink);
            }
          } catch (e) {
            if (sheet.href) {
              const newLink = pipWin.document.createElement('link');
              newLink.rel = 'stylesheet';
              newLink.href = sheet.href;
              pipWin.document.head.appendChild(newLink);
            }
          }
        });

        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.padding = '0';
        pipWin.document.body.style.background = '#ffffff';
        pipWin.document.body.style.overflow = 'auto';
        pipWin.document.title = 'Desktop Memory Agent';

        const rootDiv = pipWin.document.createElement('div');
        rootDiv.id = 'pip-portal-root';
        rootDiv.style.width = '100%';
        rootDiv.style.minHeight = '100%';
        pipWin.document.body.appendChild(rootDiv);

        setContainer(rootDiv);

        pipWin.addEventListener('pagehide', () => {
          setContainer(null);
          pipWindowRef.current = null;
          onClose();
        });
      } catch (err) {
        console.warn('Document PiP request was not opened, using in-page popup modal instead.', err);
      }
    };

    openPip();

    return () => {
      if (pipWindowRef.current) {
        try { pipWindowRef.current.close(); } catch (e) {}
        pipWindowRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (!container) return null;

  return createPortal(children, container);
}
