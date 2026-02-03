const templates = {
  classic: {
    name: 'Classic Elegance',
    styles: `
      .card { background: #fefefe; border: 3px double #c9b8a8; }
      .header { color: #5c4a3d; }
      .names { color: #5c4a3d; }
    `
  },
  modern: {
    name: 'Modern Minimal',
    styles: `
      .card { background: #ffffff; box-shadow: inset 0 0 0 1px #e0e0e0; }
      .header { font-family: 'Inter', sans-serif; letter-spacing: 2px; text-transform: uppercase; font-size: 24px; color: #2d2d2d; }
      .recipient { font-family: 'Inter', sans-serif; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: #5a5a5a; }
      .message { font-family: 'Inter', sans-serif; }
      .signature-text { font-family: 'Inter', sans-serif; font-size: 10px; }
      .names { color: #4a4a4a; }
    `
  },
  romantic: {
    name: 'Romantic Blush',
    styles: `
      .card { background: linear-gradient(180deg, #fff5f2 0%, #f9eae5 100%); border: 1px solid #e8d4cc; }
      .header { color: #c9a89a; font-style: italic; }
      .recipient { color: #8b6b5a; }
      .names { color: #c9a89a; }
    `
  },
  botanical: {
    name: 'Botanical',
    styles: `
      .card { background: #f5f8f5; border: 2px solid #b8c4b8; }
    `
  },
  vintage: {
    name: 'Vintage Charm',
    styles: `
      .card { background: #faf8f5; border: 2px solid #c9b8a8; }
    `
  },
  champagne: {
    name: 'Champagne Luxe',
    styles: `
      .card { background: linear-gradient(135deg, #faf9f7 0%, #f0ece5 100%); border: 3px solid #b8a090; }
    `
  },
  rustic: {
    name: 'Rustic',
    styles: `
      .card { background: #fdfcfa; border: 2px dashed #b8a090; }
    `
  },
  watercolor: {
    name: 'Watercolor',
    styles: `
      .card { background: linear-gradient(135deg, #fff9f7 0%, #fdf5f0 100%); }
      .header { color: #c9a89a; }
      .names { color: #c9a89a; }
    `
  },
  formal: {
    name: 'Formal',
    styles: `
      .card { background: white; box-shadow: inset 0 0 0 2px #d4c5b5, inset 0 0 0 4px white, inset 0 0 0 5px #d4c5b5; }
    `
  },
  minimal: {
    name: 'Minimal',
    styles: `
      .card { background: white; border: 1px solid #e5e5e5; }
      .header { font-family: 'Inter', sans-serif; letter-spacing: 2px; text-transform: uppercase; font-size: 24px; }
      .recipient { font-family: 'Inter', sans-serif; }
      .message { font-family: 'Inter', sans-serif; }
      .signature-text { font-family: 'Inter', sans-serif; }
    `
  }
};

module.exports = templates;