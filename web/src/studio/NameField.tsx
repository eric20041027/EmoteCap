import { useEffect, useState } from 'react';
export function NameField({label,name,onChange,disabled=false}:{label:string;name:string;onChange:(name:string)=>void;disabled?:boolean}) {
  const [draft,setDraft]=useState(name),[error,setError]=useState<string|null>(null);
  useEffect(()=>setDraft(name),[name]);
  return <label className="studio-field">{label}
    <input aria-label={label} value={draft} maxLength={120} disabled={disabled} aria-invalid={!!error}
      onChange={event=>{
        const value=event.target.value;setDraft(value);
        if(!value.trim()) {setError('A name is required.');return;}
        try {onChange(value);setError(null);} catch(failure) {setError(failure instanceof Error?failure.message:'Name could not be changed.');}
      }} onBlur={()=>{if(!draft.trim()) setDraft(name);}} onKeyDown={event=>{if(event.key==='Enter') event.currentTarget.blur();}} />
    {error && <span className="studio-error">{error}</span>}
  </label>;
}
