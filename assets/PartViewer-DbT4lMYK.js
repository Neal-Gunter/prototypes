import{r as e}from"./rolldown-runtime-XKyaHtl9.js";import{n as t,t as n}from"./jsx-runtime-C3cWAN_r.js";import{d as r,l as i,n as a,r as o,s,t as c}from"./OrbitControls-Bf2N6NLs.js";import{$a as l,Fr as u,Ln as d,Lo as f,M as p,Nr as m,Ut as h,Y as ee,bo as g,co as _,dn as te,dr as v,fn as y,lo as b,sa as ne,sr as x,uo as S,ur as C,va as w,yn as T}from"./index-DNfViGqI.js";import{r as E}from"./Gltf-58sjBmW4.js";import{i as D,n as O}from"./catalog-wNSBJ45N.js";import{i as re,n as ie}from"./partMeshes-DUPBZCQo.js";var k=e(t()),ae=e(f()),A=new b,j=new b,M=new b,N=new _;function oe(e,t,n){let r=A.setFromMatrixPosition(e.matrixWorld);r.project(t);let i=n.width/2,a=n.height/2;return[r.x*i+i,-(r.y*a)+a]}function se(e,t){let n=A.setFromMatrixPosition(e.matrixWorld),r=j.setFromMatrixPosition(t.matrixWorld),i=n.sub(r),a=t.getWorldDirection(M);return i.angleTo(a)>Math.PI/2}function ce(e,t,n,r){let i=A.setFromMatrixPosition(e.matrixWorld),a=i.clone();a.project(t),N.set(a.x,a.y),n.setFromCamera(N,t);let o=n.intersectObjects(r,!0);if(o.length){let e=o[0].distance;return i.distanceTo(n.ray.origin)<e}return!0}function le(e,t){if(t instanceof m)return t.zoom;if(t instanceof u){let n=A.setFromMatrixPosition(e.matrixWorld),r=j.setFromMatrixPosition(t.matrixWorld),i=t.fov*Math.PI/180,a=n.distanceTo(r);return 1/(2*Math.tan(i/2)*a)}return 1}function ue(e,t,n){if(t instanceof u||t instanceof m){let r=A.setFromMatrixPosition(e.matrixWorld),i=j.setFromMatrixPosition(t.matrixWorld),a=r.distanceTo(i),o=(n[1]-n[0])/(t.far-t.near),s=n[1]-o*t.far;return Math.round(o*a+s)}}var de=e=>Math.abs(e)<1e-10?0:e;function P(e,t,n=``){let r=`matrix3d(`;for(let n=0;n!==16;n++)r+=de(t[n]*e.elements[n])+(n===15?`)`:`,`);return n+r}var fe=(e=>t=>P(t,e))([1,-1,1,1,1,-1,1,1,1,-1,1,1,1,-1,1,1]),pe=(e=>(t,n)=>P(t,e(n),`translate(-50%,-50%)`))(e=>[1/e,1/e,1/e,1,-1/e,-1/e,-1/e,-1,1/e,1/e,1/e,1,1,1,1,1]);function me(e){return e&&typeof e==`object`&&`current`in e}var F=k.forwardRef(({children:e,eps:t=.001,style:n,className:r,prepend:o,center:c,fullscreen:l,portal:u,distanceFactor:d,sprite:f=!1,transform:p=!1,occlude:m,onOcclude:h,castShadow:ee,receiveShadow:g,material:_,geometry:te,zIndexRange:v=[16777271,0],calculatePosition:y=oe,as:ne=`div`,wrapperClass:x,pointerEvents:S=`auto`,...C},w)=>{let{gl:T,camera:E,scene:D,size:O,raycaster:re,events:ie,viewport:A}=i(),[j]=k.useState(()=>document.createElement(ne)),M=k.useRef(null),N=k.useRef(null),P=k.useRef(0),F=k.useRef([0,0]),I=k.useRef(null),L=k.useRef(null),R=u?.current||ie.connected||T.domElement.parentNode,z=k.useRef(null),B=k.useRef(!1),V=k.useMemo(()=>m&&m!==`blending`||Array.isArray(m)&&m.length&&me(m[0]),[m]);k.useLayoutEffect(()=>{let e=T.domElement;m&&m===`blending`?(e.style.zIndex=`${Math.floor(v[0]/2)}`,e.style.position=`absolute`,e.style.pointerEvents=`none`):(e.style.zIndex=null,e.style.position=null,e.style.pointerEvents=null)},[m]),k.useLayoutEffect(()=>{if(N.current){let e=M.current=ae.createRoot(j);if(D.updateMatrixWorld(),p)j.style.cssText=`position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;`;else{let e=y(N.current,E,O);j.style.cssText=`position:absolute;top:0;left:0;transform:translate3d(${e[0]}px,${e[1]}px,0);transform-origin:0 0;`}return R&&(o?R.prepend(j):R.appendChild(j)),()=>{R&&R.removeChild(j),e.unmount()}}},[R,p]),k.useLayoutEffect(()=>{x&&(j.className=x)},[x]);let H=k.useMemo(()=>p?{position:`absolute`,top:0,left:0,width:O.width,height:O.height,transformStyle:`preserve-3d`,pointerEvents:`none`}:{position:`absolute`,transform:c?`translate3d(-50%,-50%,0)`:`none`,...l&&{top:-O.height/2,left:-O.width/2,width:O.width,height:O.height},...n},[n,c,l,O,p]),he=k.useMemo(()=>({position:`absolute`,pointerEvents:S}),[S]);k.useLayoutEffect(()=>{if(B.current=!1,p){var t;(t=M.current)==null||t.render(k.createElement(`div`,{ref:I,style:H},k.createElement(`div`,{ref:L,style:he},k.createElement(`div`,{ref:w,className:r,style:n,children:e}))))}else{var i;(i=M.current)==null||i.render(k.createElement(`div`,{ref:w,style:H,className:r,children:e}))}});let U=k.useRef(!0);s(e=>{if(N.current){E.updateMatrixWorld(),N.current.updateWorldMatrix(!0,!1);let e=p?F.current:y(N.current,E,O);if(p||Math.abs(P.current-E.zoom)>t||Math.abs(F.current[0]-e[0])>t||Math.abs(F.current[1]-e[1])>t){let t=se(N.current,E),n=!1;V&&(Array.isArray(m)?n=m.map(e=>e.current):m!==`blending`&&(n=[D]));let r=U.current;if(n){let e=ce(N.current,E,re,n);U.current=e&&!t}else U.current=!t;r!==U.current&&(h?h(!U.current):j.style.display=U.current?`block`:`none`);let i=Math.floor(v[0]/2),a=m?V?[v[0],i]:[i-1,0]:v;if(j.style.zIndex=`${ue(N.current,E,a)}`,p){let[e,t]=[O.width/2,O.height/2],n=E.projectionMatrix.elements[5]*t,{isOrthographicCamera:r,top:i,left:a,bottom:o,right:s}=E,c=fe(E.matrixWorldInverse),l=r?`scale(${n})translate(${de(-(s+a)/2)}px,${de((i+o)/2)}px)`:`translateZ(${n}px)`,u=N.current.matrixWorld;f&&(u=E.matrixWorldInverse.clone().transpose().copyPosition(u).scale(N.current.scale),u.elements[3]=u.elements[7]=u.elements[11]=0,u.elements[15]=1),j.style.width=O.width+`px`,j.style.height=O.height+`px`,j.style.perspective=r?``:`${n}px`,I.current&&L.current&&(I.current.style.transform=`${l}${c}translate(${e}px,${t}px)`,L.current.style.transform=pe(u,1/((d||10)/400)))}else{let t=d===void 0?1:le(N.current,E)*d;j.style.transform=`translate3d(${e[0]}px,${e[1]}px,0) scale(${t})`}F.current=e,P.current=E.zoom}}if(!V&&z.current&&!B.current){if(p){if(I.current){let e=I.current.children[0];if(e!=null&&e.clientWidth&&e!=null&&e.clientHeight){let{isOrthographicCamera:t}=E;if(t||te)C.scale&&(Array.isArray(C.scale)?C.scale instanceof b?z.current.scale.copy(C.scale.clone().divideScalar(1)):z.current.scale.set(1/C.scale[0],1/C.scale[1],1/C.scale[2]):z.current.scale.setScalar(1/C.scale));else{let t=(d||10)/400,n=e.clientWidth*t,r=e.clientHeight*t;z.current.scale.set(n,r,1)}B.current=!0}}}else{let t=j.children[0];if(t!=null&&t.clientWidth&&t!=null&&t.clientHeight){let e=1/A.factor,n=t.clientWidth*e,r=t.clientHeight*e;z.current.scale.set(n,r,1),B.current=!0}z.current.lookAt(e.camera.position)}}});let W=k.useMemo(()=>({vertexShader:p?void 0:`
          /*
            This shader is from the THREE's SpriteMaterial.
            We need to turn the backing plane into a Sprite
            (make it always face the camera) if "transfrom"
            is false.
          */
          #include <common>

          void main() {
            vec2 center = vec2(0., 1.);
            float rotation = 0.0;

            // This is somewhat arbitrary, but it seems to work well
            // Need to figure out how to derive this dynamically if it even matters
            float size = 0.03;

            vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
            vec2 scale;
            scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
            scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );

            bool isPerspective = isPerspectiveMatrix( projectionMatrix );
            if ( isPerspective ) scale *= - mvPosition.z;

            vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale * size;
            vec2 rotatedPosition;
            rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
            rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
            mvPosition.xy += rotatedPosition;

            gl_Position = projectionMatrix * mvPosition;
          }
      `,fragmentShader:`
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `}),[p]);return k.createElement(`group`,a({},C,{ref:N}),m&&!V&&k.createElement(`mesh`,{castShadow:ee,receiveShadow:g,ref:z},te||k.createElement(`planeGeometry`,null),_||k.createElement(`shaderMaterial`,{side:2,vertexShader:W.vertexShader,fragmentShader:W.fragmentShader})))}),I=E>=125?`uv1`:`uv2`,L=new p,R=new b,z=class extends te{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new h([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new h([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new y(t,6,1);return this.setAttribute(`instanceStart`,new T(n,3,0)),this.setAttribute(`instanceEnd`,new T(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new y(n,t*2,1);return this.setAttribute(`instanceColorStart`,new T(r,t,0)),this.setAttribute(`instanceColorEnd`,new T(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new g(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new p);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),L.setFromBufferAttribute(t),this.boundingBox.union(L))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new w),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)R.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(R)),R.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(R));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},B=class extends z{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},V=class extends ne{constructor(e){super({type:`LineMaterial`,uniforms:l.clone(l.merge([r.common,r.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new _(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
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
					#include <${E>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},H=new S,he=new b,U=new b,W=new S,G=new S,K=new S,ge=new b,_e=new C,q=new d,ve=new b,J=new p,Y=new w,X=new S,Z,Q;function ye(e,t,n){return X.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),X.multiplyScalar(1/X.w),X.x=Q/n.width,X.y=Q/n.height,X.applyMatrix4(e.projectionMatrixInverse),X.multiplyScalar(1/X.w),Math.abs(Math.max(X.x,X.y))}function be(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){q.start.fromBufferAttribute(i,r),q.end.fromBufferAttribute(a,r),q.applyMatrix4(n);let o=new b,s=new b;Z.distanceSqToSegment(q.start,q.end,s,o),s.distanceTo(o)<Q*.5&&t.push({point:s,pointOnLine:o,distance:Z.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[I]:null})}}function xe(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;Z.at(1,K),K.w=1,K.applyMatrix4(t.matrixWorldInverse),K.applyMatrix4(r),K.multiplyScalar(1/K.w),K.x*=i.x/2,K.y*=i.y/2,K.z=0,ge.copy(K),_e.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(W.fromBufferAttribute(s,t),G.fromBufferAttribute(c,t),W.w=1,G.w=1,W.applyMatrix4(_e),G.applyMatrix4(_e),W.z>u&&G.z>u)continue;if(W.z>u){let e=W.z-G.z,t=(W.z-u)/e;W.lerp(G,t)}else if(G.z>u){let e=G.z-W.z,t=(G.z-u)/e;G.lerp(W,t)}W.applyMatrix4(r),G.applyMatrix4(r),W.multiplyScalar(1/W.w),G.multiplyScalar(1/G.w),W.x*=i.x/2,W.y*=i.y/2,G.x*=i.x/2,G.y*=i.y/2,q.start.copy(W),q.start.z=0,q.end.copy(G),q.end.z=0;let o=q.closestPointToPointParameter(ge,!0);q.at(o,ve);let l=x.lerp(W.z,G.z,o),d=l>=-1&&l<=1,f=ge.distanceTo(ve)<Q*.5;if(d&&f){q.start.fromBufferAttribute(s,t),q.end.fromBufferAttribute(c,t),q.start.applyMatrix4(a),q.end.applyMatrix4(a);let r=new b,i=new b;Z.distanceSqToSegment(q.start,q.end,i,r),n.push({point:i,pointOnLine:r,distance:Z.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[I]:null})}}}var Se=class extends v{constructor(e=new z,t=new V({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)he.fromBufferAttribute(t,e),U.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+he.distanceTo(U);let i=new y(r,2,1);return e.setAttribute(`instanceDistanceStart`,new T(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new T(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;Z=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;Q=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),Y.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?Q*.5:ye(r,Math.max(r.near,Y.distanceToPoint(Z.origin)),s.resolution),Y.radius+=c,Z.intersectsSphere(Y)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),J.copy(o.boundingBox).applyMatrix4(a);let l;l=n?Q*.5:ye(r,Math.max(r.near,J.distanceToPoint(Z.origin)),s.resolution),J.expandByScalar(l),Z.intersectsBox(J)!==!1&&(n?be(this,t):xe(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(H),this.material.uniforms.resolution.value.set(H.z,H.w))}},Ce=class extends Se{constructor(e=new B,t=new V({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},we=k.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:o,segments:s,dashed:c,...l},u){var d;let f=i(e=>e.size),p=k.useMemo(()=>s?new Se:new Ce,[s]),[m]=k.useState(()=>new V),h=(n==null||(d=n[0])==null?void 0:d.length)===4?4:3,g=k.useMemo(()=>{let r=s?new z:new B,i=e.map(e=>{let t=Array.isArray(e);return e instanceof b||e instanceof S?[e.x,e.y,e.z]:e instanceof _?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof ee?e.toArray():e);r.setColors(e.flat(),h)}return r},[e,s,n,h]);return k.useLayoutEffect(()=>{p.computeLineDistances()},[e,p]),k.useLayoutEffect(()=>{c?m.defines.USE_DASH=``:delete m.defines.USE_DASH,m.needsUpdate=!0},[c,m]),k.useEffect(()=>()=>{g.dispose(),m.dispose()},[g]),k.createElement(`primitive`,a({object:p,ref:u},l),k.createElement(`primitive`,{object:g,attach:`geometry`}),k.createElement(`primitive`,a({object:m,attach:`material`,color:t,vertexColors:!!n,resolution:[f.width,f.height],linewidth:r??o??1,dashed:c,transparent:h===4},l)))}),$=n();function Te(e){return e<=12?1:e<=60?5:e<=250?10:50}function Ee({from:e,dir:t,len:n,label:r,side:i}){let[a,o]=(0,k.useState)(!1);(0,k.useEffect)(()=>{let e=setTimeout(()=>o(!0),30);return()=>clearTimeout(e)},[]);let s=n*10,c=Te(s),l=[e,e.map((e,r)=>e+t[r]*n)],u=[];for(let r=0;r<=s+1e-6;r+=c){let a=e.map((e,n)=>e+t[n]*r/10),o=Math.round(r)%(c*5)==0,s=a.map((e,t)=>e+i[t]*(o?.25:.12)*Math.max(.4,n/6));u.push((0,$.jsx)(we,{points:[a,s],color:`#b45309`,lineWidth:1},r))}let d=e.map((e,r)=>e+t[r]*n/2+i[r]*.5*Math.max(.5,n/5));return(0,$.jsxs)(`group`,{children:[(0,$.jsx)(we,{points:l,color:`#b45309`,lineWidth:2}),u,a&&(0,$.jsx)(F,{position:d,center:!0,zIndexRange:[20,0],children:(0,$.jsx)(`span`,{className:`pointer-events-none select-none whitespace-nowrap rounded bg-white/90 px-1 text-[11px] text-amber-800`,"data-testid":`ruler-label`,children:r})})]})}function De({d:e}){let t=e.x/10,n=e.y/10,r=e.z/10,i=[-t/2,0,r/2+.15];return(0,$.jsxs)(`group`,{children:[(0,$.jsx)(Ee,{from:i,dir:[1,0,0],len:t,side:[0,0,1],label:`长 ${e.x} mm`}),(0,$.jsx)(Ee,{from:[t/2+.15,0,r/2],dir:[0,0,-1],len:r,side:[1,0,0],label:`宽 ${e.z} mm`}),(0,$.jsx)(Ee,{from:[-t/2-.15,0,r/2],dir:[0,1,0],len:n,side:[-1,0,0],label:`高 ${e.y} mm`})]})}function Oe({id:e}){let[t,n]=(0,k.useState)(null),[r,i]=(0,k.useState)(!0);(0,k.useEffect)(()=>{n(null),e&&O(e).then(e=>n(e?D(e):null)).catch(()=>n(null))},[e]);let a=t?.dims_mm,s=(0,k.useMemo)(()=>{let e=a?Math.max(a.x,a.y,a.z)/10:5;return[e*1.9,e*1.5,e*2.4]},[a]);return t?(0,$.jsxs)(`div`,{className:`relative`,"data-testid":`part-viewer`,children:[(0,$.jsx)(`div`,{className:`aspect-square w-full border border-line bg-white`,children:(0,$.jsxs)(o,{camera:{position:s,fov:35,near:.01,far:500},dpr:[1,1.5],frameloop:`demand`,children:[(0,$.jsx)(`ambientLight`,{intensity:.8}),(0,$.jsx)(`directionalLight`,{position:[5,8,6],intensity:1.4}),(0,$.jsx)(k.Suspense,{fallback:null,children:t.kind===`glb`?(0,$.jsx)(ie,{def:t}):(0,$.jsx)(re,{def:t})}),r&&(0,$.jsx)(De,{d:a}),(0,$.jsx)(`gridHelper`,{args:[Math.ceil(Math.max(a.x,a.z)/10)*2+2,Math.ceil(Math.max(a.x,a.z)/10)*2+2,`#cbd5e1`,`#e2e8f0`]}),(0,$.jsx)(c,{makeDefault:!0,target:[0,a.y/20,0]})]},e)}),(0,$.jsxs)(`div`,{className:`mt-1 flex items-center justify-between text-xs text-ink-soft`,children:[(0,$.jsxs)(`span`,{children:[`网格 1 格 = 10 mm；刻度 `,Te(Math.max(a.x,a.y,a.z)),` mm`]}),(0,$.jsx)(`button`,{type:`button`,onClick:()=>i(e=>!e),"aria-pressed":r,className:`border border-line px-2 py-0.5`,"data-testid":`ruler-toggle`,children:r?`隐藏标尺`:`显示标尺`})]})]}):(0,$.jsx)(`div`,{className:`flex aspect-square w-full items-center justify-center border border-line bg-paper-2 text-xs text-ink-soft`,children:`加载模型…`})}export{Oe as default};