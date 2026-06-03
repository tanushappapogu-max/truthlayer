import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TruthLayer — Citation Verification Engine';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0c0d12',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: 'white',
            }}
          >
            ✓
          </div>
          <span style={{ fontSize: '56px', fontWeight: 800, color: 'white', letterSpacing: '-1px' }}>
            Truth<span style={{ color: '#6366f1' }}>Layer</span>
          </span>
        </div>
        <p style={{ fontSize: '24px', color: '#8b8fa8', maxWidth: '700px', textAlign: 'center', lineHeight: 1.5 }}>
          A calibrated acceptance gate for citation hallucination in AI search
        </p>
        <div
          style={{
            display: 'flex',
            gap: '32px',
            marginTop: '32px',
            fontSize: '16px',
            color: '#4a4e6a',
          }}
        >
          <span>3-Stage Detector</span>
          <span>·</span>
          <span>1,036 Benchmark Cases</span>
          <span>·</span>
          <span>8 Detector Signals</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
