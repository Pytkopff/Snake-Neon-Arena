import { createPublicClient, http, isAddress } from 'viem';
import { base, mainnet } from 'viem/chains';
import { generateWalletPseudonym, getDefaultWalletAvatar } from './walletIdentity';

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

const cache = new Map();

const tryResolveEns = async (client, address, source) => {
  try {
    const name = await client.getEnsName({ address });
    if (!name) return null;
    let avatarUrl = null;
    try {
      avatarUrl = await client.getEnsAvatar({ name });
    } catch {
      avatarUrl = null;
    }
    return { name, avatarUrl, source };
  } catch {
    return null;
  }
};

export const resolveWalletProfile = async (address) => {
  if (!address || !isAddress(address)) return null;

  const normalized = address.toLowerCase();
  if (cache.has(normalized)) return cache.get(normalized);

  let resolved = await tryResolveEns(baseClient, normalized, 'base');
  if (!resolved) {
    resolved = await tryResolveEns(mainnetClient, normalized, 'mainnet');
  }

  const profile = resolved?.name
    ? {
        displayName: resolved.name,
        avatarUrl: resolved.avatarUrl || getDefaultWalletAvatar(normalized),
        source: resolved.source,
      }
    : {
        displayName: generateWalletPseudonym(normalized),
        avatarUrl: getDefaultWalletAvatar(normalized),
        source: 'pseudonym',
      };

  cache.set(normalized, profile);
  return profile;
};
