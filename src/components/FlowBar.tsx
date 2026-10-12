import { FlowBarAurora } from './FlowBarAurora';
import { FlowBarBeam } from './FlowBarBeam';
import { FlowBarClassic } from './FlowBarClassic';
import { FlowBarClean } from './FlowBarClean';

// 게이지 디자인 비교용: 주소에 ?bar=clean | classic | aurora | beam 을 붙이면 그 디자인으로 본다 (기본 clean).
const VARIANTS = { clean: FlowBarClean, beam: FlowBarBeam, aurora: FlowBarAurora, classic: FlowBarClassic };
const pick = new URLSearchParams(location.search).get('bar');
const Variant = VARIANTS[pick as keyof typeof VARIANTS] ?? FlowBarClean;

type Props = {
  /** 0..1 을 돌려주는 함수. 매 프레임 호출된다. */
  progress: () => number;
  /** 연간 게이지: 아래에 12개월 눈금을 그린다 */
  months?: { year: number };
};

/** 시간이 흐르고 있음을 보여주는 게이지 */
export function FlowBar(props: Props) {
  return <Variant {...props} />;
}
