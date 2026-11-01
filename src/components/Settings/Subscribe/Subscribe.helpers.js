export const formatDuration = (iso) => {
  if (!iso) return '';
  const l = iso.length;
  const n = iso.slice(1, l - 1);
  if (n === '1') {
    return (
      { D: 'Day', W: 'Week', M: 'Month', Y: 'Year' }[iso[l - 1]] || iso[l - 1]
    );
  } else {
    const u =
      { D: 'Days', W: 'Weeks', M: 'Months', Y: 'Years' }[iso[l - 1]] ||
      iso[l - 1];
    return `${n} ${u}`;
  }
};

const APP_TITLE_MARKER = '(Cboard AAC)';

export const formatTitle = (title) => {
  if (!title) return '';
  const formattedTitle = title.split(APP_TITLE_MARKER).join('');
  if (formattedTitle === title) return title;
  return formattedTitle.trim();
};
