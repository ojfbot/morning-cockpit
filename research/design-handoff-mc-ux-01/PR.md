# Commit + PR

```sh
cd morning-cockpit
git checkout main && git pull
git checkout -b design/mc-ux-01-handoff
mkdir -p research/design-handoff-mc-ux-01
# unzip the bundle, then copy its contents:
cp -R design_handoff_mc_ux_01/. research/design-handoff-mc-ux-01/
rm research/design-handoff-mc-ux-01/PR.md research/design-handoff-mc-ux-01/screenshots/debug.jpg
git add research/design-handoff-mc-ux-01
git commit -m "research: MC-UX-01 design handoff — UX discovery + experimental redesign"
git push -u origin design/mc-ux-01-handoff
gh pr create --base main --head design/mc-ux-01-handoff \
  --title "research: MC-UX-01 design handoff (UX discovery + experimental redesign)" \
  --body-file research/design-handoff-mc-ux-01/PR-BODY.md
```
