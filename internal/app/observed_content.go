package app

// Equality of captured content, not a promise of a database transaction or
// immunity to GUI changes between reads. Legacy read epochs may differ.
func sameObservedContent(a, b *actionResult) bool {
	if a == nil || b == nil || a.Context == nil || b.Context == nil || a.Context.ProjectUUID != b.Context.ProjectUUID || a.Context.DocumentUUID != b.Context.DocumentUUID {
		return false
	}
	hash, ok := a.Result["observation_hash"].(string)
	return ok && hash != "" && hash == b.Result["observation_hash"]
}
