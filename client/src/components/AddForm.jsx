import { useRef, useState } from 'react';
import { CATEGORIES, atNoon, todayInput } from '../lib/format.js';

// Guesses a category from the title, so "Metro card" is not filed under Food just because Food is the default.
// The first match wins; Fun and Study come before Travel so "movie ticket" is Fun and "train ticket" is Travel.
const HINTS = [
  ['Fun', /\b(movie|movies|netflix|spotify|prime|hotstar|game|games|party|concert|outing|bowling|gift)\b/i],
  ['Study', /\b(book|books|course|pen|pens|notebook|stationery|fees?|exam|xerox|print|printouts?|tuition|udemy|lab)\b/i],
  ['Travel', /\b(metro|bus|auto|uber|ola|rapido|cab|taxi|train|flight|petrol|fuel|ticket|travel|parking|toll)\b/i],
  ['Food', /\b(lunch|dinner|breakfast|chai|tea|coffee|snacks?|food|pizza|burger|biryani|swiggy|zomato|meal|canteen|mess|juice|samosa|maggi)\b/i],
];
export const guessCategory = title => (HINTS.find(([, re]) => re.test(title)) || [])[0];

// Quick-add form: type, press Enter, and the cursor jumps back to the title for the next one.
export default function AddForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [picked, setPicked] = useState(false); // once you tap a category yourself, we stop guessing
  const [date, setDate] = useState(todayInput());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const titleRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      // Today needs no date: the server stamps the current time.
      await onAdd({ title, amount, category, date: date === todayInput() ? undefined : atNoon(date) });
      setTitle('');
      setAmount('');
      setPicked(false);
      titleRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add card" onSubmit={submit}>
      <div className="add-main">
        <input ref={titleRef} aria-label="What did you buy" placeholder="What did you buy?" value={title} onChange={e => { setTitle(e.target.value); if (!picked) setCategory(guessCategory(e.target.value) || 'Food'); }} required maxLength={80} />
        <label className="money"><span aria-hidden="true">₹</span>
          <input aria-label="Amount in rupees" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} required />
        </label>
      </div>
      <div className="add-meta">
        <div className="cats" role="radiogroup" aria-label="Category">
          {CATEGORIES.map(c => (
            <button key={c} type="button" role="radio" aria-checked={category === c} className={category === c ? 'chip on' : 'chip'} onClick={() => { setCategory(c); setPicked(true); }}>
              <i className={'dot ' + c} />{c}
            </button>
          ))}
        </div>
        <input className="when" type="date" aria-label="Date" value={date} max={todayInput()} onChange={e => setDate(e.target.value || todayInput())} />
        <button className="primary" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
