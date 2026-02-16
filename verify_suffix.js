import { Attribution } from 'ox/erc8021';

const suffix = Attribution.toDataSuffix({
    codes: ['boik5nwq'],
});

console.log('Generated Suffix:', suffix);
console.log('Length:', suffix.length);
console.log('Last 32 chars:', suffix.slice(-32));
