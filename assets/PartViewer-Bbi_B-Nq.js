import{r as e}from"./rolldown-runtime-XKyaHtl9.js";import{n as t,t as n}from"./jsx-runtime-C3cWAN_r.js";import{r}from"./index-C6etVqBB.js";import{E as i,Lt as a,U as o,an as s,ar as c,fa as l,io as u,ir as d,jn as f,kt as p,mo as m,no as h,on as g,pn as _,qa as v,ro as y,ta as b,tr as x}from"./three.core-Dp-eO7LC.js";import{d as S,l as C,n as w,r as ee,t as te}from"./OrbitControls-wreLr0lH.js";import{t as ne}from"./Html-CdIc6pQz.js";import{r as T}from"./Gltf-o-YXdeYP.js";import{d as re}from"./palette-BHC8OqYc.js";import{i as ie,n as ae}from"./catalog-rc1ZUPvo.js";import{a as oe,i as se,n as ce}from"./partMeshes-SG92ojNY.js";var E=T>=125?`uv1`:`uv2`,D=new i,O=new y,k=class extends s{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new a([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new a([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new g(t,6,1);return this.setAttribute(`instanceStart`,new _(n,3,0)),this.setAttribute(`instanceEnd`,new _(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new g(n,t*2,1);return this.setAttribute(`instanceColorStart`,new _(r,t,0)),this.setAttribute(`instanceColorEnd`,new _(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new m(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new i);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),D.setFromBufferAttribute(t),this.boundingBox.union(D))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new l),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)O.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(O)),O.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(O));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},A=class extends k{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},j=class extends b{constructor(e){super({type:`LineMaterial`,uniforms:v.clone(v.merge([S.common,S.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new h(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${T>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},M=new u,N=new y,P=new y,F=new u,I=new u,L=new u,R=new y,z=new d,B=new f,V=new y,H=new i,U=new l,W=new u,G,K;function q(e,t,n){return W.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),W.multiplyScalar(1/W.w),W.x=K/n.width,W.y=K/n.height,W.applyMatrix4(e.projectionMatrixInverse),W.multiplyScalar(1/W.w),Math.abs(Math.max(W.x,W.y))}function le(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){B.start.fromBufferAttribute(i,r),B.end.fromBufferAttribute(a,r),B.applyMatrix4(n);let o=new y,s=new y;G.distanceSqToSegment(B.start,B.end,s,o),s.distanceTo(o)<K*.5&&t.push({point:s,pointOnLine:o,distance:G.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[E]:null})}}function ue(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;G.at(1,L),L.w=1,L.applyMatrix4(t.matrixWorldInverse),L.applyMatrix4(r),L.multiplyScalar(1/L.w),L.x*=i.x/2,L.y*=i.y/2,L.z=0,R.copy(L),z.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(F.fromBufferAttribute(s,t),I.fromBufferAttribute(c,t),F.w=1,I.w=1,F.applyMatrix4(z),I.applyMatrix4(z),F.z>u&&I.z>u)continue;if(F.z>u){let e=F.z-I.z,t=(F.z-u)/e;F.lerp(I,t)}else if(I.z>u){let e=I.z-F.z,t=(I.z-u)/e;I.lerp(F,t)}F.applyMatrix4(r),I.applyMatrix4(r),F.multiplyScalar(1/F.w),I.multiplyScalar(1/I.w),F.x*=i.x/2,F.y*=i.y/2,I.x*=i.x/2,I.y*=i.y/2,B.start.copy(F),B.start.z=0,B.end.copy(I),B.end.z=0;let o=B.closestPointToPointParameter(R,!0);B.at(o,V);let l=x.lerp(F.z,I.z,o),d=l>=-1&&l<=1,f=R.distanceTo(V)<K*.5;if(d&&f){B.start.fromBufferAttribute(s,t),B.end.fromBufferAttribute(c,t),B.start.applyMatrix4(a),B.end.applyMatrix4(a);let r=new y,i=new y;G.distanceSqToSegment(B.start,B.end,i,r),n.push({point:i,pointOnLine:r,distance:G.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[E]:null})}}}var J=class extends c{constructor(e=new k,t=new j({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)N.fromBufferAttribute(t,e),P.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+N.distanceTo(P);let i=new g(r,2,1);return e.setAttribute(`instanceDistanceStart`,new _(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new _(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;G=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;K=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),U.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?K*.5:q(r,Math.max(r.near,U.distanceToPoint(G.origin)),s.resolution),U.radius+=c,G.intersectsSphere(U)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),H.copy(o.boundingBox).applyMatrix4(a);let l;l=n?K*.5:q(r,Math.max(r.near,H.distanceToPoint(G.origin)),s.resolution),H.expandByScalar(l),G.intersectsBox(H)!==!1&&(n?le(this,t):ue(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(M),this.material.uniforms.resolution.value.set(M.z,M.w))}},de=class extends J{constructor(e=new A,t=new j({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},Y=e(t()),X=Y.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:i,segments:a,dashed:s,...c},l){var d;let f=C(e=>e.size),p=Y.useMemo(()=>a?new J:new de,[a]),[m]=Y.useState(()=>new j),g=(n==null||(d=n[0])==null?void 0:d.length)===4?4:3,_=Y.useMemo(()=>{let r=a?new k:new A,i=e.map(e=>{let t=Array.isArray(e);return e instanceof y||e instanceof u?[e.x,e.y,e.z]:e instanceof h?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof o?e.toArray():e);r.setColors(e.flat(),g)}return r},[e,a,n,g]);return Y.useLayoutEffect(()=>{p.computeLineDistances()},[e,p]),Y.useLayoutEffect(()=>{s?m.defines.USE_DASH=``:delete m.defines.USE_DASH,m.needsUpdate=!0},[s,m]),Y.useEffect(()=>()=>{_.dispose(),m.dispose()},[_]),Y.createElement(`primitive`,w({object:p,ref:l},c),Y.createElement(`primitive`,{object:_,attach:`geometry`}),Y.createElement(`primitive`,w({object:m,attach:`material`,color:t,vertexColors:!!n,resolution:[f.width,f.height],linewidth:r??i??1,dashed:s,transparent:g===4},c)))}),Z=n();function Q(e){return e<=12?1:e<=60?5:e<=250?10:50}function $({from:e,dir:t,len:n,label:r,side:i}){let[a,o]=(0,Y.useState)(!1);(0,Y.useEffect)(()=>{let e=setTimeout(()=>o(!0),30);return()=>clearTimeout(e)},[]);let s=n*10,c=Q(s),l=[e,e.map((e,r)=>e+t[r]*n)],u=[];for(let r=0;r<=s+1e-6;r+=c){let a=e.map((e,n)=>e+t[n]*r/10),o=Math.round(r)%(c*5)==0,s=a.map((e,t)=>e+i[t]*(o?.25:.12)*Math.max(.4,n/6));u.push((0,Z.jsx)(X,{points:[a,s],color:`#b45309`,lineWidth:1},r))}let d=e.map((e,r)=>e+t[r]*n/2+i[r]*.5*Math.max(.5,n/5));return(0,Z.jsxs)(`group`,{children:[(0,Z.jsx)(X,{points:l,color:`#b45309`,lineWidth:2}),u,a&&(0,Z.jsx)(ne,{position:d,center:!0,zIndexRange:[20,0],children:(0,Z.jsx)(`span`,{className:`pointer-events-none select-none whitespace-nowrap rounded bg-paper-2/90 px-1 text-[11px] text-amber-800`,"data-testid":`ruler-label`,children:r})})]})}function fe({d:e}){let t=e.x/10,n=e.y/10,r=e.z/10,i=[-t/2,0,r/2+.15];return(0,Z.jsxs)(`group`,{children:[(0,Z.jsx)($,{from:i,dir:[1,0,0],len:t,side:[0,0,1],label:`长 ${e.x} mm`}),(0,Z.jsx)($,{from:[t/2+.15,0,r/2],dir:[0,0,-1],len:r,side:[1,0,0],label:`宽 ${e.z} mm`}),(0,Z.jsx)($,{from:[-t/2-.15,0,r/2],dir:[0,1,0],len:n,side:[-1,0,0],label:`高 ${e.y} mm`})]})}var pe=[[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];function me({cols:e}){let t=(0,Y.useMemo)(()=>e.map(e=>{let t=e.hull?oe(e):null;if(t){let n=new p(t,20).attributes.position,r=[];for(let t=0;t<n.count;t++)r.push([e.c[0]+n.getX(t),e.c[1]+n.getY(t),e.c[2]+n.getZ(t)]);return r}let n=[];for(let t=0;t<8;t++)n.push([e.c[0]+(t&1?1:-1)*e.h[0],e.c[1]+(t&2?1:-1)*e.h[1],e.c[2]+(t&4?1:-1)*e.h[2]]);return pe.flatMap(([e,t])=>[n[e],n[t]])}),[e]),n=[`#dc2626`,`#2563eb`,`#16a34a`,`#9333ea`,`#ea580c`,`#0891b2`];return(0,Z.jsx)(`group`,{children:t.map((e,t)=>(0,Z.jsx)(X,{points:e,segments:!0,color:n[t%n.length],lineWidth:1.5,depthTest:!1,transparent:!0,opacity:.85},t))})}function he({id:e}){let[,,t]=r(),n=re(t),i=t===`dark`,[a,o]=(0,Y.useState)(null),[s,c]=(0,Y.useState)(!0),[l,u]=(0,Y.useState)(!1);(0,Y.useEffect)(()=>{o(null),e&&ae(e).then(e=>o(e?ie(e):null)).catch(()=>o(null))},[e]);let d=a?.dims_mm,f=(0,Y.useMemo)(()=>{let e=d?Math.max(d.x,d.y,d.z)/10:5;return[e*1.9,e*1.5,e*2.4]},[d]);return a?(0,Z.jsxs)(`div`,{className:`relative`,"data-testid":`part-viewer`,children:[(0,Z.jsx)(`div`,{className:`aspect-square w-full border border-line bg-paper-2`,children:(0,Z.jsxs)(ee,{camera:{position:f,fov:35,near:.01,far:500},dpr:[1,1.5],frameloop:`demand`,children:[(0,Z.jsx)(`color`,{attach:`background`,args:[n.paper]}),(0,Z.jsx)(`hemisphereLight`,{args:[`#f4efe6`,`#6e5a45`,.7]}),(0,Z.jsx)(`directionalLight`,{position:[5,8,6],intensity:i?.85:1.15}),(0,Z.jsx)(`directionalLight`,{position:[-4,3,-2],intensity:i?.16:.25}),(0,Z.jsx)(Y.Suspense,{fallback:null,children:a.kind===`glb`?(0,Z.jsx)(ce,{def:a}):(0,Z.jsx)(se,{def:a})}),s&&(0,Z.jsx)(fe,{d}),l&&(0,Z.jsx)(me,{cols:a.colliders}),(0,Z.jsx)(`gridHelper`,{args:[Math.ceil(Math.max(d.x,d.z)/10)*2+2,Math.ceil(Math.max(d.x,d.z)/10)*2+2,n.inkSoft,n.line]}),(0,Z.jsx)(te,{makeDefault:!0,target:[0,d.y/20,0]})]},e)}),(0,Z.jsxs)(`div`,{className:`mt-1 flex items-center justify-between text-xs text-ink-soft`,children:[(0,Z.jsxs)(`span`,{children:[`网格 1 格 = 10 mm；刻度 `,Q(Math.max(d.x,d.y,d.z)),` mm`]}),(0,Z.jsxs)(`span`,{className:`flex gap-1`,children:[(0,Z.jsx)(`button`,{type:`button`,onClick:()=>u(e=>!e),"aria-pressed":l,className:`border border-line px-2 py-0.5`,"data-testid":`collider-toggle`,children:l?`隐藏碰撞体`:`显示碰撞体`}),(0,Z.jsx)(`button`,{type:`button`,onClick:()=>c(e=>!e),"aria-pressed":s,className:`border border-line px-2 py-0.5`,"data-testid":`ruler-toggle`,children:s?`隐藏标尺`:`显示标尺`})]})]}),l&&(0,Z.jsxs)(`p`,{className:`mt-1 text-[11px] leading-snug text-ink-soft`,"data-testid":`collider-info`,children:[`碰撞体：`,a.colliders.filter(e=>e.hull).length?`${a.colliders.length} 个凸包`:`${a.colliders.length} 个盒`,`（物理引擎按这些凸块算碰撞）。`,a.collider_decomp?.hull?(0,Z.jsxs)(Z.Fragment,{children:[`凸包分解（构建时，我的补充）：先做体素凸分解（体素 `,a.collider_decomp.cell_mm,` mm，容差 `,a.collider_decomp.tol_mm,` mm），原来 `,a.collider_decomp.hull.boxes,` 个盒 → 收紧合并成 `,a.collider_decomp.hull.n,` 个凸包；比可见网格最多外扩 `,a.collider_decomp.hull.box_exMax_mm,` → `,a.collider_decomp.hull.exMax_mm,` mm（中位 `,a.collider_decomp.hull.p50_mm,` mm），网格顶点全部被覆盖。`]}):a.collider_decomp?(0,Z.jsxs)(Z.Fragment,{children:[`体素凸分解（构建时，我的补充）：体素 `,a.collider_decomp.cell_mm,` mm，盒子比可见网格最多外扩 `,a.collider_decomp.exMax_mm,` mm（容差 `,a.collider_decomp.tol_mm,` mm = 体素对角线），网格表面全部被覆盖。`]}):a.kind===`glb`?(0,Z.jsx)(Z.Fragment,{children:`由模型各部件的包围盒自动生成，可能比外形稍大（估算）。`}):(0,Z.jsx)(Z.Fragment,{children:`程序生成零件，碰撞盒即外形（近似）。`})]})]}):(0,Z.jsx)(`div`,{className:`flex aspect-square w-full items-center justify-center border border-line bg-paper-2 text-xs text-ink-soft`,children:`加载模型…`})}export{he as default};