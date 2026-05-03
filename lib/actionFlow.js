'use client';
import { supabase } from './supabase';

let dbRules = null;

export async function loadFlowRules() {
  try {
    const { data, error } = await supabase
      .from('action_flow_rules')
      .select('current_action,current_outcome,current_type,next_action,next_outcome,next_type,next_action_player,next_reaction_player');
    if (error) throw error;
    dbRules = data || [];
  } catch {
    dbRules = null;
  }
}

const DEFAULT_NEXT = {
  action: 'Pass', outcome: 'Successful', type: null,
  actionPlayer: null, reactionPlayer: null,
};

export function getNextEntry(prevAction, prevOutcome, prevType, prevActionPlayer, prevReactionPlayer) {
  let rule = null;

  if (dbRules?.length) {
    rule = dbRules.find(r =>
      r.current_action === prevAction &&
      r.current_outcome === prevOutcome &&
      r.current_type === prevType
    ) ?? dbRules.find(r =>
      r.current_action === prevAction &&
      r.current_outcome === prevOutcome &&
      r.current_type === 'ANY'
    ) ?? dbRules.find(r =>
      r.current_action === prevAction &&
      r.current_outcome === prevOutcome
    );
  }

  if (!rule) return DEFAULT_NEXT;

  return {
    action:         rule.next_action,
    outcome:        rule.next_outcome,
    type:           rule.next_type,
    actionPlayer:   resolvePlayer(rule.next_action_player,   prevActionPlayer, prevReactionPlayer),
    reactionPlayer: resolvePlayer(rule.next_reaction_player, prevActionPlayer, prevReactionPlayer),
  };
}

function resolvePlayer(token, prevAction, prevReaction) {
  if (token === 'prevAction')   return prevAction   ?? null;
  if (token === 'prevReaction') return prevReaction ?? null;
  if (token === 'prevReaction_or_prevAction') return prevReaction ?? prevAction ?? null;
  return null;
}
