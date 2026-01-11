import { supabase } from './supabaseClient';

export const upsertPlayerProfile = async (profileData) => {
  if (!profileData.address && !profileData.fid) return null;

  const { data, error } = await supabase
    .from('player_profiles_v2')
    .upsert({
      wallet_address: profileData.address?.toLowerCase(),
      farcaster_fid: profileData.fid,
      farcaster_username: profileData.username,
      avatar_url: profileData.pfpUrl,
      display_name: profileData.displayName || profileData.username,
      last_active: new Date().toISOString(),
    }, { onConflict: 'wallet_address' })
    .select();

  if (error) {
    console.error('Error syncing profile:', error);
    return null;
  }
  return data?.[0];
};