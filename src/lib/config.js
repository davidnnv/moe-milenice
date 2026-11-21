// Business details shown on the site. Change them here.
export const BUSINESS = {
  name: { mk: 'Мое Милениче', en: 'Moe Milenice' },
  phone: '070 246 555',
  phoneHref: 'tel:+38970246555',
  viberHref: 'viber://chat?number=%2B38970246555',
  address: { mk: 'Христо Татарчев 23, Скопје 1000', en: 'Hristo Tatarchev 23, Skopje 1000' },
  mapsLink: 'https://www.google.com/maps/search/?api=1&query=Moe+Milenice+grooming+salon+Hristo+Tatarchev+23+Skopje',
  mapsEmbed: 'https://www.google.com/maps?q=Moe+Milenice+grooming+salon,+Hristo+Tatarchev+23,+Skopje&output=embed',
  reviewsLink: 'https://www.google.com/search?q=Moe+Milenice+grooming+salon+Skopje',
  // Google rating as shown on Google Maps — update it when it changes.
  rating: 5.0,
  reviewCount: 13,
  instagram: '', // e.g. 'https://www.instagram.com/...'
  facebook: '',
};

// Booking rules (the database enforces the same ones).
export const BOOKING = {
  slotStepMin: 30, // a new appointment can start every 30 minutes
  leadMin: 60, // earliest booking: 1 hour from now
  daysAhead: 30, // how far ahead the calendar goes
};

// Photos in public/photos/. Add files there and list them here (alt texts in MK/EN).
export const GALLERY = [
  { src: '/photos/poodle-red-closeup.webp', alt: { mk: 'Црвена пудла после шишање', en: 'Red poodle after a trim' } },
  { src: '/photos/pomeranian.webp', alt: { mk: 'Померанец на розев креветец', en: 'Pomeranian on a pink bed' } },
  { src: '/photos/maltese.webp', alt: { mk: 'Малтезер после капење', en: 'Maltese after a bath' } },
  { src: '/photos/yorkie.webp', alt: { mk: 'Јоркширски териер на масата за нега', en: 'Yorkshire terrier on the grooming table' } },
  { src: '/photos/poodle-cream-tree.webp', alt: { mk: 'Кремаста пудла покрај новогодишна елка', en: 'Cream poodle by a Christmas tree' } },
  { src: '/photos/bichon.webp', alt: { mk: 'Бишон после шишање', en: 'Bichon after a trim' } },
  { src: '/photos/newfoundland-salon.webp', alt: { mk: 'Њуфаундленд во салонот', en: 'Newfoundland in the salon' } },
  { src: '/photos/terrier-mix.webp', alt: { mk: 'Териер после потстрижување', en: 'Terrier after a trim' } },
  { src: '/photos/jack-russell.webp', alt: { mk: 'Џек Расел се одмара после нега', en: 'Jack Russell resting after grooming' } },
  { src: '/photos/black-terrier.webp', alt: { mk: 'Црн териер со шноли', en: 'Black terrier with a hair clip' }, wide: true },
  { src: '/photos/terrier-puppy.webp', alt: { mk: 'Кученце се одмара на подот', en: 'Puppy resting on the floor' } },
];

export const HERO_PHOTOS = {
  main: { src: '/photos/poodle-red-table.webp', alt: { mk: 'Пудла после шишање во салонот', en: 'Poodle after a trim in the salon' } },
  side: { src: '/photos/bichon.webp', alt: { mk: 'Бишон после шишање', en: 'Bichon after a trim' } },
  salon: { src: '/photos/newfoundland-salon.webp', alt: { mk: 'Просторот на салонот', en: 'The salon' } },
  wide: { src: '/photos/poodle-apricot.webp', alt: { mk: 'Пудла после шишање', en: 'Poodle after a trim' } },
};
