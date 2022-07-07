class RecoveryPhrasePage {
  get recoveryPhrase() {
    return $("~Recovery Phrase");
  }
  get copyRecoveryPhrase() {
    return $("~Copy Recovery Phrase");
  }

  get cancelButton() {
    return $("~Cancel");
  }
}

module.exports = new RecoveryPhrasePage();