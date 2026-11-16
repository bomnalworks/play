// 풀이를 사람이 훑어보기 좋게 한 파일로 뽑는다. (scratch/ 는 저장소에 올라가지 않는다)
//   node scripts/dump-readings.mjs > scratch/풀이-전체.md
import { scheme, outline, groups, loadGroup } from './load-entries.mjs'

const out = [`# ${scheme.year} 토정비결 풀이 전체 (${outline.count}괘 × ${groups.length}연령대)\n`]
const byGwae = new Map(outline.entries.map((e) => [e.gwae, e]))

for (const group of groups) {
  out.push(`\n## ${scheme.ageGroups[group].label} (${scheme.ageGroups[group].range})\n`)
  for (const e of loadGroup(group).entries) {
    const o = byGwae.get(e.gwae)
    out.push(`### ${e.gwae} · ${o.grade} · ${o.name}`)
    out.push(`> ${o.symbol}`)
    out.push(`**${e.summary}**`)
    out.push(e.overall)
    e.quarters.forEach((q, i) => out.push(`- ${['1~3월', '4~6월', '7~9월', '10~12월'][i]} ${q}`))
    out.push(`조언: ${e.advice}`)
    out.push(`행운: ${e.lucky.color} · ${e.lucky.number} · ${e.lucky.keyword}\n`)
  }
}
console.log(out.join('\n'))
