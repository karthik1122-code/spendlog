import { useRef, useState } from 'react';
import { CATEGORIES, atNoon, todayInput } from './format.js';

// Quick-add form: type, press Enter, and the cursor jumps back to the title for the next one.
export default function AddForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
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
        <input ref={titleRef} aria-label="What did you buy" placeholder="What did you buy?" value={title} onChange={e => setTitle(e.target.value)} required maxLength={80} />
        <label className="money"><span aria-hidden="true">₹</span>
          <input aria-label="Amount in rupees" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} required />
        </label>
      </div>
      <div className="add-meta">
        <div className="cats" role="radiogroup" aria-label="Category">
          {CATEGORIES.map(c => (
            <button key={c} type="button" role="radio" aria-checked={category === c} className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(c)}>
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
